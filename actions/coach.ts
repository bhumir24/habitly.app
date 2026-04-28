"use server";

import { revalidatePath } from "next/cache";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { coachMessageSchema } from "@/lib/validations";
import { getAIProvider } from "@/ai/provider";
import { canUse } from "@/lib/feature-flags";
import { FREE_LIMITS } from "@/lib/feature-flags";
import type { Adaptation, GeneratedHabit, Habit, HabitLog } from "@/types";
import { deriveAdaptations } from "@/services/adaptation-engine";

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

  // Free-tier daily cap.
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
    activeHabits: (habits ?? []) as Habit[],
    recentLogs: (logs ?? []) as HabitLog[],
    mood: parsed.data.mood,
    blocker: parsed.data.blocker,
  });

  // Parse inline habit suggestion embedded by the AI provider
  let habitSuggestion: GeneratedHabit | undefined;
  const habitActionMatch = reply.match(/\[HABIT_ACTION:(\{.*\})\]/);
  const cleanReply = reply.replace(/\s*\[HABIT_ACTION:\{.*\}\]/, "").trim();
  if (habitActionMatch) {
    try { habitSuggestion = JSON.parse(habitActionMatch[1]) as GeneratedHabit; } catch { /* ignore */ }
  }

  await supabase.from("coach_messages").insert({
    user_id: user.id,
    role: "assistant",
    content: cleanReply,
    context: habitSuggestion ? { habitSuggestion } : {},
  });

  revalidatePath("/coach");
  return { ok: true as const, reply: cleanReply, habitSuggestion };
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
