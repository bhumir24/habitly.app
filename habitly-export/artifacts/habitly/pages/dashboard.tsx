import { useQueryClient } from "@tanstack/react-query";
import {
  useGetDashboardSummary,
  useCreateLog,
  useGetAdaptations,
  useApplyAdaptation,
  getGetDashboardSummaryQueryKey,
  getListHabitsQueryKey,
  type HabitWithTodayStatus,
  type Adaptation,
} from "@workspace/api-client-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle2,
  Circle,
  Zap,
  TrendingUp,
  Target,
  Flame,
  ChevronRight,
  Lightbulb,
  Clock,
} from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

function ProgressRing({ value, size = 56, stroke = 5 }: { value: number; size?: number; stroke?: number }) {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="white"
        strokeWidth={stroke}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.6s ease" }}
      />
    </svg>
  );
}

function StatCard({
  label,
  value,
  sub,
  gradient,
  icon: Icon,
  progress,
}: {
  label: string;
  value: string | number;
  sub?: string;
  gradient: string;
  icon: React.ElementType;
  progress?: number;
}) {
  return (
    <div
      className="relative rounded-2xl p-5 overflow-hidden text-white"
      style={{ background: gradient, boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}
    >
      <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/10" />
      <div className="absolute -bottom-6 -right-2 w-28 h-28 rounded-full bg-white/5" />
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-3">
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
            <Icon className="w-4.5 h-4.5 text-white" />
          </div>
          {progress !== undefined && (
            <ProgressRing value={progress} size={44} stroke={4} />
          )}
        </div>
        <p className="text-3xl font-display font-semibold leading-none mb-1">{value}</p>
        <p className="text-[13px] font-medium text-white/80">{label}</p>
        {sub && <p className="text-[11px] text-white/60 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function HabitCard({
  habit,
  onComplete,
  onSkip,
  index,
}: {
  habit: HabitWithTodayStatus;
  onComplete: (id: number) => void;
  onSkip: (id: number) => void;
  index: number;
}) {
  const done = habit.todayStatus === "completed";
  const skipped = habit.todayStatus === "skipped";

  const accentColors = [
    "hsl(245 70% 58%)",
    "hsl(262 60% 65%)",
    "hsl(200 70% 55%)",
    "hsl(152 60% 45%)",
    "hsl(25 90% 60%)",
  ];
  const accent = accentColors[index % accentColors.length];

  return (
    <div
      className={cn(
        "bg-white rounded-2xl border overflow-hidden transition-all duration-200",
        done ? "opacity-90" : "hover:shadow-md",
        skipped ? "opacity-60" : ""
      )}
      style={{
        borderColor: "hsl(220 14% 91%)",
        boxShadow: done ? "none" : "var(--shadow-sm)",
      }}
      data-testid={`habit-card-${habit.id}`}
    >
      <div className="flex">
        <div
          className="w-1.5 flex-shrink-0 rounded-l-2xl"
          style={{ background: done ? "hsl(152 60% 45%)" : skipped ? "hsl(220 14% 80%)" : accent }}
        />
        <div className="flex-1 p-4">
          <div className="flex items-start gap-3">
            <button
              onClick={() => !done && !skipped && onComplete(habit.id)}
              disabled={done || skipped}
              data-testid={`button-complete-${habit.id}`}
              className="mt-0.5 flex-shrink-0 transition-transform active:scale-90"
            >
              {done ? (
                <CheckCircle2 className="w-5 h-5" style={{ color: "hsl(152 60% 45%)" }} />
              ) : (
                <Circle className="w-5 h-5 text-muted-foreground/30 hover:text-primary transition-colors" />
              )}
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <h3
                  className={cn(
                    "font-semibold text-[14px] leading-snug",
                    (done || skipped) ? "line-through text-muted-foreground" : "text-foreground"
                  )}
                >
                  {habit.title}
                </h3>
                {habit.currentStreak > 0 && (
                  <div
                    className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{ background: "hsl(25 90% 96%)", color: "hsl(25 90% 50%)" }}
                  >
                    <Flame className="w-3 h-3" />
                    {habit.currentStreak}d
                  </div>
                )}
              </div>
              <p className="text-[12px] text-muted-foreground line-clamp-1 mb-2">{habit.purpose}</p>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {habit.durationMinutes} min
                </span>
                <span
                  className="text-[11px] px-2 py-0.5 rounded-full font-medium capitalize"
                  style={{
                    background: "hsl(220 14% 95%)",
                    color: "hsl(220 10% 46%)",
                  }}
                >
                  {habit.bestTimeOfDay}
                </span>
                <span
                  className="text-[11px] px-2 py-0.5 rounded-full font-medium capitalize"
                  style={{
                    background:
                      habit.difficulty === "hard"
                        ? "hsl(0 84% 97%)"
                        : habit.difficulty === "medium"
                        ? "hsl(38 90% 96%)"
                        : "hsl(152 60% 96%)",
                    color:
                      habit.difficulty === "hard"
                        ? "hsl(0 84% 50%)"
                        : habit.difficulty === "medium"
                        ? "hsl(38 90% 44%)"
                        : "hsl(152 60% 35%)",
                  }}
                >
                  {habit.difficulty}
                </span>
              </div>
            </div>
          </div>

          {!done && !skipped && (
            <div className="flex gap-2 mt-3 pt-3 border-t border-border">
              <Button
                size="sm"
                className="flex-1 h-8 text-[12px] font-semibold rounded-xl"
                onClick={() => onComplete(habit.id)}
                data-testid={`button-done-${habit.id}`}
              >
                Mark done
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 h-8 text-[12px] rounded-xl"
                onClick={() => onSkip(habit.id)}
                data-testid={`button-skip-${habit.id}`}
              >
                Skip today
              </Button>
            </div>
          )}

          {done && (
            <div
              className="mt-3 pt-3 border-t border-border flex items-center gap-1.5 text-[12px] font-semibold"
              style={{ color: "hsl(152 60% 40%)" }}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Completed today
            </div>
          )}
          {skipped && (
            <div className="mt-3 pt-3 border-t border-border text-[12px] text-muted-foreground">
              Skipped today · Try the micro-habit: <span className="italic">{habit.fallbackMicroHabit}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { data: dashboard, isLoading } = useGetDashboardSummary();
  const { data: adaptations } = useGetAdaptations();
  const createLog = useCreateLog();
  const applyAdaptation = useApplyAdaptation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const today = new Date().toISOString().split("T")[0];

  const todayHabits = dashboard?.todayHabits ?? [];
  const completedToday = todayHabits.filter((h) => h.todayStatus === "completed").length;
  const totalHabits = todayHabits.length;
  const pct = totalHabits > 0 ? Math.round((completedToday / totalHabits) * 100) : 0;

  const handleComplete = (habitId: number) => {
    createLog.mutate(
      { data: { habitId, status: "completed", date: today } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListHabitsQueryKey() });
          toast({ title: "Habit completed", description: "Great work — keep the streak going!" });
        },
      }
    );
  };

  const handleSkip = (habitId: number) => {
    createLog.mutate(
      { data: { habitId, status: "skipped", date: today } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          toast({ title: "Skipped for today", description: "Try the micro-habit next time." });
        },
      }
    );
  };

  const handleApplyAdaptation = (adaptation: Adaptation) => {
    applyAdaptation.mutate(
      { habitId: adaptation.habitId, data: { type: adaptation.type, changes: adaptation.changes } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListHabitsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          toast({ title: "Adaptation applied", description: "Your habit has been updated." });
        },
      }
    );
  };

  const dateStr = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-5 py-8 space-y-7">
        {/* Header */}
        <div
          className="rounded-2xl px-6 py-5 text-white relative overflow-hidden"
          style={{
            background: "linear-gradient(135deg, hsl(232 28% 16%) 0%, hsl(245 35% 22%) 100%)",
            boxShadow: "0 8px 32px rgba(30,28,60,0.18)",
          }}
        >
          <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/5" />
          <div className="absolute -bottom-6 right-20 w-24 h-24 rounded-full bg-white/4" />
          <div className="relative z-10">
            <p className="text-[13px] text-white/60 mb-1">{dateStr}</p>
            <h1 className="text-[22px] font-display font-semibold leading-tight">
              {greeting}{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
            </h1>
            <p className="text-[13px] text-white/60 mt-1.5">
              {completedToday === totalHabits && totalHabits > 0
                ? "All habits done — incredible work today!"
                : `${completedToday} of ${totalHabits} habits done today`}
            </p>
          </div>
        </div>

        {/* Stat Cards */}
        {isLoading ? (
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            <StatCard
              label="Today"
              value={`${completedToday}/${totalHabits}`}
              sub="habits done"
              gradient="linear-gradient(135deg, hsl(245 70% 58%) 0%, hsl(262 60% 65%) 100%)"
              icon={Target}
              progress={pct}
            />
            <StatCard
              label="Streak"
              value={dashboard?.longestStreak ?? 0}
              sub="day best"
              gradient="linear-gradient(135deg, hsl(25 90% 58%) 0%, hsl(38 85% 62%) 100%)"
              icon={Flame}
            />
            <StatCard
              label="This week"
              value={
                dashboard?.weekCompletionRate !== undefined
                  ? `${Math.round(dashboard.weekCompletionRate * 100)}%`
                  : "—"
              }
              sub="completion"
              gradient="linear-gradient(135deg, hsl(200 70% 52%) 0%, hsl(220 65% 58%) 100%)"
              icon={TrendingUp}
            />
          </div>
        )}

        {/* AI Suggestions */}
        {adaptations && adaptations.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-6 h-6 rounded-lg flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, hsl(38 90% 55%), hsl(25 90% 62%))" }}
              >
                <Lightbulb className="w-3.5 h-3.5 text-white" />
              </div>
              <h2 className="text-[14px] font-semibold">AI Suggestions</h2>
            </div>
            <div className="space-y-2">
              {adaptations.slice(0, 2).map((a, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-4 rounded-2xl border"
                  style={{
                    background: "linear-gradient(135deg, hsl(38 90% 98%) 0%, hsl(245 70% 98%) 100%)",
                    borderColor: "hsl(38 80% 88%)",
                  }}
                >
                  <div className="flex-1">
                    <p
                      className="text-[11px] font-semibold mb-0.5 uppercase tracking-wide"
                      style={{ color: "hsl(245 70% 58%)" }}
                    >
                      {a.habitTitle}
                    </p>
                    <p className="text-[13px] text-foreground">{a.suggestion}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 h-7 text-[12px] rounded-lg"
                    onClick={() => handleApplyAdaptation(a)}
                    data-testid={`button-apply-adaptation-${i}`}
                  >
                    Apply
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Habit List */}
        <div>
          {isLoading && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
            </div>
          )}
          {!isLoading && (
            <>
              <h2 className="text-[14px] font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
                Today's habits
              </h2>
              <div className="space-y-3">
                {todayHabits.map((habit, i) => (
                  <HabitCard
                    key={habit.id}
                    habit={habit}
                    index={i}
                    onComplete={handleComplete}
                    onSkip={handleSkip}
                  />
                ))}
                {todayHabits.length === 0 && (
                  <div className="text-center py-14">
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                      style={{ background: "linear-gradient(135deg, hsl(245 70% 95%), hsl(262 60% 95%))" }}
                    >
                      <Target className="w-6 h-6" style={{ color: "hsl(245 70% 58%)" }} />
                    </div>
                    <p className="text-[15px] font-semibold mb-1">No habits yet</p>
                    <p className="text-[13px] text-muted-foreground mb-5">Set up your personalized plan to get started</p>
                    <Link href="/onboarding">
                      <Button data-testid="button-start-onboarding" className="rounded-xl">
                        Start onboarding
                      </Button>
                    </Link>
                  </div>
                )}
              </div>

              {todayHabits.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border">
                  <Link
                    href="/insights"
                    className="flex items-center justify-between py-2.5 px-3 rounded-xl text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all group"
                  >
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      View weekly insights
                    </div>
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
