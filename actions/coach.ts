"use server";

import { revalidatePath } from "next/cache";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { coachMessageSchema } from "@/lib/validations";
import { getAIProvider } from "@/ai/provider";
import { canUse } from "@/lib/feature-flags";
import { FREE_LIMITS } from "@/lib/feature-flags";
import type { Adaptation, GeneratedHabit, Habit, HabitEdit, HabitLog } from "@/types";
import { updateHabit } from "@/actions/habits";
import { firstNameFromFullName } from "@/lib/utils";

// Finds the start of the JSON object for [TAG_NAME:{...}], skipping optional
// whitespace between ":" and "{". Returns the index of "{", or -1 if not found.
function findTagStart(text: string, tagName: string): { tagStart: number; jsonStart: number } | null {
  const prefix = `[${tagName}:`;
  const tagStart = text.indexOf(prefix);
  if (tagStart === -1) return null;
  let i = tagStart + prefix.length;
  // Skip optional whitespace between ":" and "{"
  while (i < text.length && text[i] !== "{" && /\s/.test(text[i])) i++;
  if (i >= text.length || text[i] !== "{") return null;
  return { tagStart, jsonStart: i };
}

// Extracts the JSON object from [TAG_NAME:{...}] using brace depth tracking.
function extractTagJSON(text: string, tagName: string): string | null {
  const pos = findTagStart(text, tagName);
  if (!pos) return null;
  let i = pos.jsonStart;
  let depth = 0;
  while (i < text.length) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) return text.slice(pos.jsonStart, i + 1);
    }
    i++;
  }
  return null;
}

// Removes [TAG_NAME:{...}] (and its closing ]) from displayed text.
function stripTag(text: string, tagName: string): string {
  const pos = findTagStart(text, tagName);
  if (!pos) return text;
  let i = pos.jsonStart;
  let depth = 0;
  while (i < text.length) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) {
        // Skip past the closing "]" that follows the JSON object
        let end = i + 1;
        while (end < text.length && /\s/.test(text[end])) end++;
        if (text[end] === "]") end++;
        return (text.slice(0, pos.tagStart) + text.slice(end)).replace(/\s{2,}/g, " ").trim();
      }
    }
    i++;
  }
  return text;
}

// Strips filler suffixes AIs tend to add to habit titles (e.g. "Gardening as new habit" → "Gardening").
function sanitizeHabitTitle(title: string): string {
  return title
    .replace(/\s+as\s+(a\s+)?(new\s+)?habit\b.*$/i, "")
    .replace(/\s+(new\s+)?habit\b\s*$/i, "")
    .trim()
    .replace(/^(.)/, (c) => c.toUpperCase());
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

  const ai = await getAIProvider();
  const reply = await ai.coachReply({
    history: history ?? [],
    userMessage: parsed.data.content,
    profileContext: {
      life_mode: profile?.life_mode ?? "flexible",
      energy_baseline: profile?.energy_baseline ?? "medium",
      timezone: profile?.timezone ?? "UTC",
      first_name: firstNameFromFullName(profile?.full_name ?? null) ?? undefined,
    },
    onboarding: onboarding ?? null,
    activeHabits,
    recentLogs: (logs ?? []) as HabitLog[],
    mood: parsed.data.mood,
    blocker: parsed.data.blocker,
  });

  if (process.env.NODE_ENV === "development") {
    console.log("[coach] raw AI reply:", reply);
  }

  let habitSuggestion: GeneratedHabit | undefined;
  let habitEdit: HabitEdit | undefined;

  // Parse [HABIT_ACTION:JSON] — new habit suggestion
  const habitActionJSON = extractTagJSON(reply, "HABIT_ACTION");
  if (habitActionJSON) {
    try {
      const raw = JSON.parse(habitActionJSON) as GeneratedHabit;
      const suggested = { ...raw, title: sanitizeHabitTitle(raw.title) };
      const matchedId = await ai.matchHabit({
        userMessage: parsed.data.content,
        suggestedTitle: suggested.title,
        habits: activeHabits,
      });
      const existing = matchedId ? activeHabits.find((h) => h.id === matchedId) : undefined;
      if (existing) {
        // User asked to ADD — never auto-patch attributes. Just surface the card.
        const alreadyNote = `${existing.duration_minutes}m · ${existing.preferred_time.replace(/_/g, " ")} · ${existing.frequency.replace(/_/g, " ")}`;
        habitEdit = {
          habit_id: existing.id,
          title: existing.title,
          description: `Already in your plan — ${alreadyNote}. View or edit it on the dashboard.`,
          patch: {},
        };
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

      // Try exact UUID first. If the AI hallucinated the ID (common), fall back to title match.
      let resolvedId: string | null = null;
      const { data: byId } = await supabase
        .from("habits")
        .select("id")
        .eq("id", editRequest.habit_id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (byId) {
        resolvedId = byId.id;
      } else {
        const byTitle = await ai.matchHabit({
          userMessage: parsed.data.content,
          suggestedTitle: editRequest.title,
          habits: activeHabits,
        });
        if (byTitle) resolvedId = byTitle;
      }

      if (process.env.NODE_ENV === "development") {
        console.log("[coach] HABIT_EDIT json:", habitEditJSON);
        console.log("[coach] resolved habit id:", resolvedId, "| by UUID:", !!byId, "| patch:", editRequest.patch);
      }

      if (resolvedId) {
        const { remind_at, ...habitPatch } = editRequest.patch;
        const result = await updateHabit(resolvedId, habitPatch);
        if (process.env.NODE_ENV === "development") {
          console.log("[coach] updateHabit result:", result);
        }
        if (result.ok) {
          if (remind_at) {
            await supabase
              .from("reminders")
              .update({ remind_at })
              .eq("habit_id", resolvedId)
              .eq("user_id", user.id);
          }
          habitEdit = { ...editRequest, habit_id: resolvedId };
        }
      }
    } catch (e) {
      if (process.env.NODE_ENV === "development") console.error("[coach] HABIT_EDIT parse error:", e);
    }
  }

  // Apply auto-converted edit (from duplicate detection above).
  // Skip updateHabit when patch is empty — habit already has the right settings.
  if (habitEdit && habitActionJSON && !habitEditJSON && Object.keys(habitEdit.patch).length > 0) {
    const result = await updateHabit(habitEdit.habit_id, habitEdit.patch);
    if (!result.ok) habitEdit = undefined;
  }

  // Strip both tags from the displayed text
  let cleanReply = stripTag(reply, "HABIT_ACTION");
  cleanReply = stripTag(cleanReply, "HABIT_EDIT");

  // When a HABIT_ACTION was converted to a duplicate card, replace the AI's
  // "Here's X..." text with a clean message so the UI doesn't look like a new suggestion.
  if (habitEdit && habitActionJSON && !habitEditJSON) {
    const wasUpdated = Object.keys(habitEdit.patch).length > 0;
    cleanReply = wasUpdated
      ? `Updated "${habitEdit.title}" based on your request.`
      : `"${habitEdit.title}" is already in your plan.`;
  }

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
    supabase.from("habit_logs").select("*").eq("user_id", user.id),
    supabase.from("onboarding_responses").select("*").eq("user_id", user.id).maybeSingle(),
  ]);

  const ai = await getAIProvider();
  const adaptations = await ai.adapt({
    habits: (habits ?? []) as Habit[],
    logs: (logs ?? []) as HabitLog[],
    onboarding: onboarding ?? null,
  });
  return { ok: true, adaptations };
}
