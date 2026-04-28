import { redirect } from "next/navigation";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/page-header";
import { InsightsPanel } from "@/components/insights/insights-panel";
import { mondayOf, toISODate } from "@/lib/date";
import { subWeeks } from "date-fns";
import type { WeeklyReport } from "@/types";

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const thisWeek = toISODate(mondayOf());
  const lastWeek = toISODate(subWeeks(mondayOf(), 1));

  let report: WeeklyReport | null = null;
  let prevReport: WeeklyReport | null = null;
  let sub = null;

  if (process.env.DEMO_LOGIN === "true") {
    sub = { tier: "premium" };
    report = {
      id: "mock",
      user_id: user.id,
      week_start: thisWeek,
      ai_insight: "Your morning habits are carrying you — 60% completion before noon, but evenings are falling apart. Read 10 Pages is your strongest habit at 60%; Meditation is the drag at 20%. One change this week: move Meditation to the morning block right after your run.",
      recommended_next_step: "Swap Meditation to the morning slot (right after Morning Run). Don't add time — shrink it to 5 minutes for the first week to prove the slot works.",
      summary_json: {
        total_scheduled: 15,
        total_completed: 6,
        total_skipped: 9,
        completion_rate: 0.40,
        streak_days: 2,
        mood_avg: 3.2,
        most_skipped: [
          { habit_id: "h3", title: "Meditation", count: 4 },
          { habit_id: "h1", title: "Morning Run", count: 3 }
        ],
        weekday_rate: 0.47,
        weekend_rate: 0.17,
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
    };
    prevReport = {
      id: "mock-prev",
      user_id: user.id,
      week_start: lastWeek,
      ai_insight: null,
      recommended_next_step: null,
      summary_json: {
        total_scheduled: 15,
        total_completed: 4,
        total_skipped: 11,
        completion_rate: 0.27,
        streak_days: 1,
        mood_avg: 2.8,
        weekday_rate: 0.30,
        weekend_rate: 0.10,
        most_skipped: [],
        per_habit: [],
        mood_trend: [],
        best_windows: [],
        valid_blockers: [],
        excuses: []
      },
      created_at: new Date().toISOString()
    };
  } else {
    const supabase = createClient();
    const [r, prev, s] = await Promise.all([
      supabase
        .from("weekly_reports")
        .select("*")
        .eq("user_id", user.id)
        .eq("week_start", thisWeek)
        .maybeSingle(),
      supabase
        .from("weekly_reports")
        .select("*")
        .eq("user_id", user.id)
        .eq("week_start", lastWeek)
        .maybeSingle(),
      supabase.from("subscriptions").select("tier").eq("user_id", user.id).single(),
    ]);
    report = r.data;
    prevReport = prev.data ?? null;
    sub = s.data;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Weekly insights"
        subtitle="What worked, what didn't, and one concrete step for next week."
      />
      <InsightsPanel
        initial={(report as WeeklyReport) ?? null}
        prevReport={(prevReport as WeeklyReport) ?? null}
        tier={sub?.tier ?? "free"}
      />
    </div>
  );
}
