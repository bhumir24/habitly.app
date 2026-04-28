"use server";

import { revalidatePath } from "next/cache";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { buildWeeklySummary } from "@/services/habit-service";
import { getAIProvider } from "@/ai/provider";
import { mondayOf, toISODate } from "@/lib/date";
import { addDays } from "date-fns";
import type { Habit, HabitLog, WeeklyReport } from "@/types";

export async function generateWeeklyReport(weekStart?: string): Promise<
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
        week_start: toISODate(mondayOf()),
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

  const start = weekStart ? new Date(weekStart) : mondayOf();
  const startISO = toISODate(start);
  const endISO = toISODate(new Date(start.getTime() + 6 * 86400e3));
  const sixtyDaysAgo = toISODate(addDays(new Date(), -60));

  const [{ data: habits }, { data: logs }, { data: allLogs }, { data: onboarding }] = await Promise.all([
    supabase.from("habits").select("*").eq("user_id", user.id),
    supabase
      .from("habit_logs")
      .select("*")
      .eq("user_id", user.id)
      .gte("completion_date", startISO)
      .lte("completion_date", endISO),
    supabase
      .from("habit_logs")
      .select("habit_id,completion_date,status,user_id,id,mood,blocker_note,created_at")
      .eq("user_id", user.id)
      .gte("completion_date", sixtyDaysAgo),
    supabase.from("onboarding_responses").select("*").eq("user_id", user.id).maybeSingle(),
  ]);

  const summary = buildWeeklySummary(
    (habits ?? []) as Habit[],
    (logs ?? []) as HabitLog[],
    start,
    (allLogs ?? []) as HabitLog[]
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
