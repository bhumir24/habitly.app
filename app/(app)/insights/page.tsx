import { redirect } from "next/navigation";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/page-header";
import { InsightsPanel } from "@/components/insights/insights-panel";
import { buildWeeklySummary } from "@/services/habit-service";
import { calendarDateInTimeZone, prevCalendarDay } from "@/lib/date";
import type { Habit, HabitLog, WeeklyReport } from "@/types";

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const supabase = createClient();

  // Fetch profile first to get timezone before computing date ranges
  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user.id)
    .maybeSingle();
  const tz = profile?.timezone ?? "UTC";
  const weekEnd = calendarDateInTimeZone(tz);
  let startISO = weekEnd;
  for (let i = 0; i < 6; i++) startISO = prevCalendarDay(startISO);

  const [{ data: report }, { data: sub }, { data: habits }, { data: logs }, { data: dailyMoods }] =
    await Promise.all([
      supabase
        .from("weekly_reports")
        .select("*")
        .eq("user_id", user.id)
        .order("week_start", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("subscriptions").select("tier").eq("user_id", user.id).single(),
      supabase.from("habits").select("*").eq("user_id", user.id).eq("is_active", true),
      supabase
        .from("habit_logs")
        .select("*")
        .eq("user_id", user.id)
        .gte("completion_date", startISO)
        .lte("completion_date", weekEnd),
      supabase
        .from("daily_moods")
        .select("mood_date, mood")
        .eq("user_id", user.id)
        .gte("mood_date", startISO)
        .lte("mood_date", weekEnd),
    ]);

  // Always compute a fresh summary from live DB data — no Re-run needed for charts/stats
  const liveSummary = buildWeeklySummary(
    (habits ?? []) as Habit[],
    (logs ?? []) as HabitLog[],
    tz,
    {
      weekMondayISO: startISO,
      dailyMoods: (dailyMoods ?? []) as Array<{ mood_date: string; mood: number }>,
    }
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Weekly insights"
        subtitle="Last 7 days — charts update automatically. Hit Re-run to refresh AI suggestions."
      />
      <InsightsPanel
        initial={(report as WeeklyReport) ?? null}
        liveSummary={liveSummary}
        tier={sub?.tier ?? "free"}
      />
    </div>
  );
}
