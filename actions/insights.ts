"use server";

import { revalidatePath } from "next/cache";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { buildWeeklySummary } from "@/services/habit-service";
import { getAIProvider } from "@/ai/provider";
import {
  calendarDateInTimeZone,
  nextCalendarDay,
  prevCalendarDay,
} from "@/lib/date";
import type { Habit, HabitLog, WeeklyReport } from "@/types";

export async function generateWeeklyReport(): Promise<
  { ok: true; report: WeeklyReport } | { ok: false; error: string }
> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const supabase = createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user.id)
    .maybeSingle();
  const tz = profile?.timezone ?? "UTC";

  // Always use rolling last 7 days so today's completions are always included
  const weekEnd = calendarDateInTimeZone(tz);
  let startISO = weekEnd;
  for (let i = 0; i < 6; i++) startISO = prevCalendarDay(startISO);

  const [{ data: habits }, { data: logs }, { data: onboarding }, { data: dailyMoods }] = await Promise.all([
    supabase.from("habits").select("*").eq("user_id", user.id).eq("is_active", true),
    supabase
      .from("habit_logs")
      .select("*")
      .eq("user_id", user.id)
      .gte("completion_date", startISO)
      .lte("completion_date", weekEnd),
    supabase.from("onboarding_responses").select("*").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("daily_moods")
      .select("mood_date, mood")
      .eq("user_id", user.id)
      .gte("mood_date", startISO)
      .lte("mood_date", weekEnd),
  ]);

  const summary = buildWeeklySummary((habits ?? []) as Habit[], (logs ?? []) as HabitLog[], tz, {
    weekMondayISO: startISO,
    dailyMoods: (dailyMoods ?? []) as Array<{ mood_date: string; mood: number }>,
  });

  const ai = await getAIProvider();
  const { insight, next_step } = await ai.weeklyInsight({
    summary,
    onboarding: onboarding ?? null,
  });

  const { data: upserted, error } = await supabase
    .from("weekly_reports")
    .upsert(
      {
        user_id: user.id,
        week_start: startISO,
        summary_json: summary,
        ai_insight: insight,
        recommended_next_step: next_step,
      },
      { onConflict: "user_id,week_start" }
    )
    .select("*")
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath("/insights");
  return { ok: true, report: upserted as WeeklyReport };
}
