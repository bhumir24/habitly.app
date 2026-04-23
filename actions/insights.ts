"use server";

import { revalidatePath } from "next/cache";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { buildWeeklySummary } from "@/services/habit-service";
import { getAIProvider } from "@/ai/provider";
import { mondayOf, toISODate } from "@/lib/date";
import type { Habit, HabitLog, WeeklyReport } from "@/types";

export async function generateWeeklyReport(weekStart?: string): Promise<
  { ok: true; report: WeeklyReport } | { ok: false; error: string }
> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const supabase = createClient();

  const start = weekStart ? new Date(weekStart) : mondayOf();
  const startISO = toISODate(start);
  const endISO = toISODate(new Date(start.getTime() + 6 * 86400e3));

  const [{ data: habits }, { data: logs }, { data: onboarding }] = await Promise.all([
    supabase.from("habits").select("*").eq("user_id", user.id),
    supabase
      .from("habit_logs")
      .select("*")
      .eq("user_id", user.id)
      .gte("completion_date", startISO)
      .lte("completion_date", endISO),
    supabase.from("onboarding_responses").select("*").eq("user_id", user.id).maybeSingle(),
  ]);

  const summary = buildWeeklySummary(
    (habits ?? []) as Habit[],
    (logs ?? []) as HabitLog[],
    start
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
