import Link from "next/link";
import { Flame, Target, CheckCircle2, Bell, Plus, Sparkles } from "lucide-react";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HabitCard } from "@/components/habit/habit-card";
import { StatCard } from "@/components/habit/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { AdaptationsPanel } from "@/components/habit/adaptations-panel";
import { SuggestedHabitsPanel } from "@/components/habit/suggested-habits-panel";
import { NewHabitDialog } from "@/components/habit/new-habit-dialog";
import {
  habitsDueToday,
  completionRate,
  computeStreak,
} from "@/services/habit-service";
import { deriveAdaptations } from "@/services/adaptation-engine";
import { todayISO } from "@/lib/date";
import type { Habit, HabitLog } from "@/types";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const supabase = createClient();

  const [{ data: profile }, { data: habits }, { data: logs }, { data: onboarding }, { data: reminders }, { data: inactiveHabits }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
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
        .gte("completion_date", new Date(Date.now() - 30 * 86400e3).toISOString().slice(0, 10)),
      supabase.from("onboarding_responses").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("reminders").select("*").eq("user_id", user.id).eq("enabled", true),
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
  const today = todayISO();

  const due = habitsDueToday(hs);
  const todaysLogs = ls.filter((l) => l.completion_date === today);
  const logByHabit = new Map(todaysLogs.map((l) => [l.habit_id, l]));
  const completedToday = due.filter((h) => logByHabit.get(h.id)?.status === "completed").length;

  const streak = computeStreak(hs, ls);
  const weekRate = completionRate(hs, ls, 7);
  const adaptations = deriveAdaptations(hs, ls, onboarding ?? null);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greeting()}${profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}`}
        subtitle={format(new Date(), "EEEE, MMM d")}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/plan-review">
              <Plus className="h-4 w-4" />
              Regenerate plan
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          icon={CheckCircle2}
          accent="success"
          label="Today"
          value={`${completedToday}/${due.length}`}
          hint={due.length ? `${Math.round((completedToday / due.length) * 100)}% done` : "No habits today"}
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
          value={reminders?.length ?? 0}
          hint="active"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Today's habits</h2>
            <NewHabitDialog />
          </div>
          {due.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="Nothing scheduled today"
              description="Use your time for a fallback micro-habit, or adjust your plan."
              action={
                <Button asChild>
                  <Link href="/plan-review">Regenerate plan</Link>
                </Button>
              }
            />
          ) : (
            <div className="space-y-3">
              {due.map((h) => (
                <HabitCard key={h.id} habit={h} log={logByHabit.get(h.id) ?? null} />
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          {adaptations.length > 0 && <AdaptationsPanel adaptations={adaptations} />}

          <SuggestedHabitsPanel inactive={(inactiveHabits ?? []) as Habit[]} />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick actions</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Button asChild variant="outline">
                <Link href="/coach">Chat with your coach</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/insights">Generate weekly report</Link>
              </Button>
              <Button asChild variant="ghost">
                <Link href="/settings">Reminders & preferences</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
