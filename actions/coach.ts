"use server";

import { revalidatePath } from "next/cache";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { coachMessageSchema } from "@/lib/validations";
import { getAIProvider } from "@/ai/provider";
import { canUse } from "@/lib/feature-flags";
import { FREE_LIMITS } from "@/lib/feature-flags";
import type { Adaptation, GeneratedHabit, Habit, HabitEdit, HabitLog } from "@/types";
import { deriveAdaptations } from "@/services/adaptation-engine";
import { updateHabit } from "@/actions/habits";

// Extracts the JSON object from [TAG_NAME:{...}] reliably using brace depth,
// so the regex approach (which breaks on nested/multi-line JSON) is avoided.
function extractTagJSON(text: string, tagName: string): string | null {
  const prefix = `[${tagName}:`;
  const start = text.indexOf(prefix);
  if (start === -1) return null;
  let i = start + prefix.length;
  if (text[i] !== "{") return null;
  let depth = 0;
  const jsonStart = i;
  while (i < text.length) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) {
        return text.slice(jsonStart, i + 1);
      }
    }
    i++;
  }
  return null;
}

// Strips [TAG_NAME:{...}] from text, regardless of surrounding whitespace.
function stripTag(text: string, tagName: string): string {
  const prefix = `[${tagName}:`;
  const start = text.indexOf(prefix);
  if (start === -1) return text;
  let i = start + prefix.length;
  if (text[i] !== "{") return text;
  let depth = 0;
  while (i < text.length) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) {
        const end = i + 2; // include the closing ]
        return (text.slice(0, start) + text.slice(end)).replace(/\s{2,}/g, " ").trim();
      }
    }
    i++;
  }
  return text;
}

// Checks if any active habit is similar to the suggested title
// (exact or partial title match, case-insensitive).
function findSimilarHabit(habits: Habit[], title: string): Habit | undefined {
  const t = title.toLowerCase().replace(/[^a-z0-9 ]/g, "");
  return habits.find((h) => {
    const ht = h.title.toLowerCase().replace(/[^a-z0-9 ]/g, "");
    // exact match, or one contains the other, or >50% word overlap
    if (ht === t || ht.includes(t) || t.includes(ht)) return true;
    const tWords = new Set(t.split(" ").filter((w) => w.length > 3));
    const htWords = ht.split(" ").filter((w) => w.length > 3);
    const overlap = htWords.filter((w) => tWords.has(w)).length;
    return overlap > 0 && overlap >= Math.min(tWords.size, htWords.length) * 0.5;
  });
}

export async function sendCoachMessage(input: {
  content: string;
  mood?: number;
  blocker?: string;
}) {
  const parsed = coachMessageSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid message" };

  const user = await getSessionUser();
  if (!user) return { ok: false as const, error: "Not authenticated" };

  const supabase = createClient();

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("tier")
    .eq("user_id", user.id)
    .single();
  const tier = sub?.tier ?? "free";

  if (tier === "free" && !canUse("free", "advanced_coach")) {
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    const { count } = await supabase
      .from("coach_messages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("role", "user")
      .gte("created_at", since.toISOString());
    if ((count ?? 0) >= FREE_LIMITS.coach_messages_per_day) {
      return {
        ok: false as const,
        error: "Daily coach limit reached. Upgrade to Premium for unlimited chat.",
      };
    }
  }

  const [{ data: onboarding }, { data: habits }, { data: logs }, { data: history }, { data: profile }] = await Promise.all([
    supabase.from("onboarding_responses").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("habits").select("*").eq("user_id", user.id).eq("is_active", true),
    supabase
      .from("habit_logs")
      .select("*")
      .eq("user_id", user.id)
      .gte("completion_date", new Date(Date.now() - 14 * 86400e3).toISOString().slice(0, 10)),
    supabase
      .from("coach_messages")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(20),
    supabase.from("profiles").select("*").eq("id", user.id).single(),
  ]);

  const activeHabits = (habits ?? []) as Habit[];

  await supabase.from("coach_messages").insert({
    user_id: user.id,
    role: "user",
    content: parsed.data.content,
    context: {
      mood: parsed.data.mood ?? null,
      blocker: parsed.data.blocker ?? null,
    },
  });

  // When the user sends a bare confirmation ("yes", "ok", etc.), append a silent
  // instruction so the LLM emits the tag immediately instead of asking again.
  const isConfirmation = /^(yes|yeah|sure|ok|okay|yep|do it|go ahead|sounds good|add it|create it|let'?s do it|proceed)[!.?\s]*$/i.test(parsed.data.content.trim());
  const llmUserMessage = isConfirmation
    ? `${parsed.data.content} [CONFIRMED: emit the HABIT_ACTION or HABIT_EDIT tag for what you proposed in your previous message. Do not ask again.]`
    : parsed.data.content;

  const ai = await getAIProvider();
  const reply = await ai.coachReply({
    history: history ?? [],
    userMessage: llmUserMessage,
    profileContext: {
      life_mode: profile?.life_mode ?? "flexible",
      energy_baseline: profile?.energy_baseline ?? "medium",
      timezone: profile?.timezone ?? "UTC",
    },
    onboarding: onboarding ?? null,
    activeHabits,
    recentLogs: (logs ?? []) as HabitLog[],
    mood: parsed.data.mood,
    blocker: parsed.data.blocker,
  });

  let habitSuggestion: GeneratedHabit | undefined;
  let habitEdit: HabitEdit | undefined;

  // Parse [HABIT_ACTION:JSON] — new habit suggestion
  const habitActionJSON = extractTagJSON(reply, "HABIT_ACTION");
  if (habitActionJSON) {
    try {
      const suggested = JSON.parse(habitActionJSON) as GeneratedHabit;
      // If a similar habit already exists, convert to an edit suggestion instead
      const existing = findSimilarHabit(activeHabits, suggested.title);
      if (existing) {
        habitEdit = {
          habit_id: existing.id,
          title: existing.title,
          description: `"${existing.title}" already exists — updating it based on your request.`,
          patch: {
            ...(suggested.duration_minutes !== existing.duration_minutes ? { duration_minutes: suggested.duration_minutes } : {}),
            ...(suggested.preferred_time !== existing.preferred_time ? { preferred_time: suggested.preferred_time } : {}),
            ...(suggested.frequency !== existing.frequency ? { frequency: suggested.frequency } : {}),
            ...(suggested.difficulty !== existing.difficulty ? { difficulty: suggested.difficulty } : {}),
          },
        };
        // Only apply edit if there's something to change
        if (Object.keys(habitEdit.patch).length === 0) {
          habitEdit = undefined;
          // habit already exists with same settings — just note it
        }
      } else {
        habitSuggestion = suggested;
      }
    } catch { /* ignore malformed JSON */ }
  }

  // Parse [HABIT_EDIT:JSON] — explicit edit request
  const habitEditJSON = extractTagJSON(reply, "HABIT_EDIT");
  if (habitEditJSON && !habitEdit) {
    try {
      const editRequest = JSON.parse(habitEditJSON) as HabitEdit;
      const { data: targetHabit } = await supabase
        .from("habits")
        .select("id")
        .eq("id", editRequest.habit_id)
        .eq("user_id", user.id)
        .single();
      if (targetHabit) {
        const result = await updateHabit(editRequest.habit_id, editRequest.patch);
        if (result.ok) habitEdit = editRequest;
      }
    } catch { /* ignore */ }
  }

  // Apply auto-converted edit (from duplicate detection above)
  if (habitEdit && habitActionJSON && !habitEditJSON) {
    const result = await updateHabit(habitEdit.habit_id, habitEdit.patch);
    if (!result.ok) habitEdit = undefined;
  }

  // Strip both tags from the displayed text
  let cleanReply = stripTag(reply, "HABIT_ACTION");
  cleanReply = stripTag(cleanReply, "HABIT_EDIT");

  await supabase.from("coach_messages").insert({
    user_id: user.id,
    role: "assistant",
    content: cleanReply,
    context: {
      ...(habitSuggestion ? { habitSuggestion } : {}),
      ...(habitEdit ? { habitEdit } : {}),
    },
  });

  revalidatePath("/coach");
  revalidatePath("/dashboard");
  return { ok: true as const, reply: cleanReply, habitSuggestion, habitEdit };
}

export async function suggestAdaptations(): Promise<
  { ok: true; adaptations: Adaptation[] } | { ok: false; error: string }
> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not authenticated" };
  const supabase = createClient();

  const [{ data: habits }, { data: logs }, { data: onboarding }] = await Promise.all([
    supabase.from("habits").select("*").eq("user_id", user.id).eq("is_active", true),
    supabase
      .from("habit_logs")
      .select("*")
      .eq("user_id", user.id)
      .gte("completion_date", new Date(Date.now() - 21 * 86400e3).toISOString().slice(0, 10)),
    supabase.from("onboarding_responses").select("*").eq("user_id", user.id).maybeSingle(),
  ]);

  const adaptations = deriveAdaptations(
    (habits ?? []) as Habit[],
    (logs ?? []) as HabitLog[],
    onboarding ?? null
  );
  return { ok: true, adaptations };
}
