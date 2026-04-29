import Link from "next/link";
import { Flame, Target, CheckCircle2, Bell } from "lucide-react";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { HabitCard } from "@/components/habit/habit-card";
import { CompletionConfetti } from "@/components/habit/completion-confetti";
import { StatCard } from "@/components/habit/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { AdaptationsPanel } from "@/components/habit/adaptations-panel";
import { NewHabitDialog } from "@/components/habit/new-habit-dialog";
import { PatternInsightCard, type PatternData } from "@/components/habit/pattern-insight-card";
import { TimeGreeting } from "@/components/dashboard/time-greeting";
import {
  habitsDueToday,
  completionRate,
  computeStreak,
} from "@/services/habit-service";
import { deriveAdaptations } from "@/services/adaptation-engine";
import {
  calendarDateInTimeZone,
  dayOfWeekForCalendarDate,
  normalizeTimeZone,
} from "@/lib/date";
import type { Habit, HabitLog } from "@/types";
import { formatInTimeZone } from "date-fns-tz";
import { firstNameFromFullName } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const supabase = createClient();

  const [
    { data: profile },
    { data: habits },
    { data: logs },
    { data: onboarding },
    { data: reminders },
    { data: inactiveHabits },
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase
      .from("habits")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("preferred_time"),
    supabase
      .from("habit_logs")
      .select("*")
      .eq("user_id", user.id)
      .gte(
        "completion_date",
        new Date(Date.now() - 30 * 86400e3).toISOString().slice(0, 10)
      ),
    supabase
      .from("onboarding_responses")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("reminders")
      .select("*")
      .eq("user_id", user.id)
      .eq("enabled", true),
    supabase
      .from("habits")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", false)
      .eq("source", "ai")
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const hs = (habits ?? []) as Habit[];
  const ls = (logs ?? []) as HabitLog[];
  const tz = profile?.timezone ?? "UTC";
  const today = calendarDateInTimeZone(tz);

  const due = habitsDueToday(hs, tz);
  const todaysLogs = ls.filter((l) => l.completion_date === today);
  const logByHabit = new Map(todaysLogs.map((l) => [l.habit_id, l]));
  const completedToday = due.filter(
    (h) => logByHabit.get(h.id)?.status === "completed"
  ).length;

  const streak = computeStreak(hs, ls, new Date(), tz);
  const weekRate = completionRate(hs, ls, 7, tz);
  const adaptations = deriveAdaptations(hs, ls, onboarding ?? null);
  const pattern = detectPatterns(hs, ls, tz);

  const progressPct = due.length > 0 ? Math.round((completedToday / due.length) * 100) : 0;

  const metadataFullName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : null;
  const displayFirstName = firstNameFromFullName(profile?.full_name ?? metadataFullName);
  const zone = normalizeTimeZone(tz);
  const subtitle = formatInTimeZone(new Date(), zone, "EEEE, MMM d");

  return (
    <div className="space-y-6">
      <CompletionConfetti completed={completedToday} total={due.length} dateKey={today} />
      <PageHeader
        title={<TimeGreeting firstName={displayFirstName} fallback={greetingForTimeZone(zone)} />}
        subtitle={subtitle}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          icon={CheckCircle2}
          accent="success"
          label="Today"
          value={`${completedToday}/${due.length}`}
          hint={
            due.length
              ? `${progressPct}% done`
              : "No habits today"
          }
        />
        <StatCard
          icon={Flame}
          accent="amber"
          label="Streak"
          value={streak}
          hint={streak === 1 ? "day" : "days in a row"}
        />
        <StatCard
          icon={Target}
          label="7-day rate"
          value={`${Math.round(weekRate * 100)}%`}
          hint="of scheduled habits"
        />
        <StatCard
          icon={Bell}
          accent="rose"
          label="Reminders"
          value={reminders?.filter((r) => habits?.some((h) => h.id === r.habit_id)).length ?? 0}
          hint="active"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ── Left column: habits list ── */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{"Today's habits"}</h2>
            <NewHabitDialog suggestions={(inactiveHabits ?? []) as Habit[]} />
          </div>

          {due.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{completedToday} of {due.length} done</span>
                <span>{progressPct}%</span>
              </div>
              <Progress value={progressPct} className="h-1.5" />
            </div>
          )}

          {due.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="Nothing scheduled today"
              description="Add a habit or adjust your plan to get started."
              action={<NewHabitDialog suggestions={(inactiveHabits ?? []) as Habit[]} />}
            />
          ) : (
            <div className="space-y-3">
              {due.map((h) => (
                <HabitCard key={h.id} habit={h} log={logByHabit.get(h.id) ?? null} />
              ))}
            </div>
          )}
        </div>

        {/* ── Right sidebar ── */}
        <div className="space-y-4">
          {adaptations.length > 0 && <AdaptationsPanel adaptations={adaptations} />}

          <PatternInsightCard pattern={pattern} />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick actions</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Button asChild variant="outline">
                <Link href="/coach">Chat with your coach</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/insights">Weekly insights</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/settings">Reminders & preferences</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function greetingForTimeZone(iana: string) {
  try {
    const h = Number(formatInTimeZone(new Date(), iana, "H"));
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  } catch {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  }
}

function detectPatterns(habits: Habit[], logs: HabitLog[], timeZone: string): PatternData {
  if (logs.length < 5) {
    return { worstDay: null, bestWindow: null, totalLoggedDays: 0 };
  }

  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dayBuckets = Array.from({ length: 7 }, () => ({ done: 0, skipped: 0 }));
  const windowMap = new Map<string, { done: number; total: number }>();

  for (const l of logs) {
    const dow = dayOfWeekForCalendarDate(l.completion_date, timeZone);
    if (l.status === "completed") dayBuckets[dow].done++;
    else if (l.status === "skipped") dayBuckets[dow].skipped++;

    const h = habits.find((h) => h.id === l.habit_id);
    if (h) {
      const w = windowMap.get(h.preferred_time) ?? { done: 0, total: 0 };
      w.total++;
      if (l.status === "completed") w.done++;
      windowMap.set(h.preferred_time, w);
    }
  }

  // Worst day: skip rate > 40% with at least 3 data points
  let worstDay: PatternData["worstDay"] = null;
  for (let i = 0; i < 7; i++) {
    const { done, skipped } = dayBuckets[i];
    const total = done + skipped;
    if (total < 3) continue;
    const skipRate = skipped / total;
    if (skipRate > 0.4 && (!worstDay || skipRate > worstDay.skipRate)) {
      worstDay = { name: DAY_NAMES[i], skipRate };
    }
  }

  // Best window: highest completion rate with at least 2 logs
  const bestWindow =
    [...windowMap.entries()]
      .filter(([, v]) => v.total >= 2)
      .sort(([, a], [, b]) => b.done / b.total - a.done / a.total)[0]?.[0] ?? null;

  const totalLoggedDays = new Set(logs.map((l) => l.completion_date)).size;
  return { worstDay, bestWindow, totalLoggedDays };
}
