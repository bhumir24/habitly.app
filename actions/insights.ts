"use server";

import { revalidatePath } from "next/cache";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { buildWeeklySummary } from "@/services/habit-service";
import { getAIProvider } from "@/ai/provider";
import { calendarDateInTimeZone, prevCalendarDay } from "@/lib/date";
import type { Habit, HabitLog, WeeklyReport } from "@/types";

export async function generateWeeklyReport(): Promise<
  { ok: true; report: WeeklyReport } | { ok: false; error: string }
> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  if (process.env.DEMO_LOGIN === "true") {
    await new Promise(r => setTimeout(r, 1000));
    return {
      ok: true,
      report: {
        id: "mock-new",
        user_id: user.id,
        week_start: calendarDateInTimeZone("UTC"),
        ai_insight: "Your morning habits are carrying you — 60% completion before noon, but evenings are falling apart. Read 10 Pages is your strongest habit at 60%; Meditation is the drag at 20%. One change this week: move Meditation to the morning block right after your run.",
        recommended_next_step: "Swap Meditation to the morning slot (right after Morning Run). Shrink it to 5 minutes for the first week to prove the slot works.",
        summary_json: {
          total_scheduled: 15,
          total_completed: 6,
          total_skipped: 9,
          completion_rate: 0.40,
          streak_days: 2,
          mood_avg: 3.2,
          weekday_rate: 0.47,
          weekend_rate: 0.17,
          most_skipped: [
            { habit_id: "h3", title: "Meditation", count: 4 },
            { habit_id: "h1", title: "Morning Run", count: 3 }
          ],
          per_habit: [
            { habit_id: "h1", title: "Morning Run", category: "movement", completed: 2, skipped: 3, rate: 0.40, streak: 1 },
            { habit_id: "h2", title: "Read 10 Pages", category: "learning", completed: 3, skipped: 2, rate: 0.60, streak: 3 },
            { habit_id: "h3", title: "Meditation", category: "mind", completed: 1, skipped: 4, rate: 0.20, streak: 0 }
          ],
          mood_trend: [
            { date: "2026-04-21", mood: 3 },
            { date: "2026-04-22", mood: 4 },
            { date: "2026-04-23", mood: 2 },
            { date: "2026-04-24", mood: 3 },
            { date: "2026-04-25", mood: 4 },
            { date: "2026-04-26", mood: 3 },
            { date: "2026-04-27", mood: 4 }
          ],
          best_windows: [
            { window: "morning", completion_rate: 0.60 },
            { window: "evening", completion_rate: 0.30 }
          ],
          valid_blockers: ["Unexpected meetings", "Family emergency"],
          excuses: ["Felt too tired after work", "Didn't feel like it", "Slept in"]
        },
        created_at: new Date().toISOString()
      } as WeeklyReport
    };
  }

  const supabase = createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user.id)
    .maybeSingle();
  const tz = profile?.timezone ?? "UTC";

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

  const summary = buildWeeklySummary(
    (habits ?? []) as Habit[],
    (logs ?? []) as HabitLog[],
    tz,
    {
      weekMondayISO: startISO,
      dailyMoods: (dailyMoods ?? []) as Array<{ mood_date: string; mood: number }>,
    }
  );

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
