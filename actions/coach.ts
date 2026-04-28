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

// Generic words that must not count as similarity signal between habit titles.
const TITLE_STOP_WORDS = new Set([
  "habit", "new", "called", "named", "every", "minutes", "daily", "session",
  "just", "some", "that", "this", "with", "want", "track", "practice", "routine",
  "more", "less", "time", "week", "days", "each", "also", "plan",
]);

// Checks if any active habit is similar to the suggested title.
// Only meaningful content words are compared — generic words are ignored.
function findSimilarHabit(habits: Habit[], title: string): Habit | undefined {
  const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "");
  const contentWords = (s: string) =>
    s.split(" ").filter((w) => w.length >= 3 && !TITLE_STOP_WORDS.has(w));

  const t = clean(title);
  const tWords = new Set(contentWords(t));

  // If the suggested title has NO meaningful content words, skip duplicate check.
  if (tWords.size === 0) return undefined;

  return habits.find((h) => {
    const ht = clean(h.title);
    // Exact title match
    if (ht === t) return true;
    // One title is a substring of the other (both non-trivially short)
    if (t.length > 6 && ht.length > 6 && (ht.includes(t) || t.includes(ht))) return true;
    // Content-word overlap ≥ 50% of the shorter set
    const htWords = contentWords(ht);
    if (htWords.length === 0) return false;
    const overlap = htWords.filter((w) => tWords.has(w)).length;
    return overlap > 0 && overlap >= Math.min(tWords.size, htWords.length) * 0.6;
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

  const ai = await getAIProvider();
  const reply = await ai.coachReply({
    history: history ?? [],
    userMessage: parsed.data.content,
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
