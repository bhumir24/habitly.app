"use client";

import { useState, useTransition } from "react";
import { Loader2, Sparkles, RefreshCw, ShieldAlert, ShieldCheck, AlertCircle, TrendingUp, TrendingDown, Minus, Flame } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PerHabitBar, MoodLine, BestWindowsBar, CategoryBar } from "./charts";
import { generateWeeklyReport } from "@/actions/insights";
import { featureCopy } from "@/lib/feature-flags";
import type { PlanTier, WeeklyReport, WeeklySummary } from "@/types";

export function InsightsPanel({
  initial,
  liveSummary,
  prevReport,
  tier,
}: {
  initial: WeeklyReport | null;
  liveSummary: WeeklySummary;
  prevReport: WeeklyReport | null;
  tier: PlanTier;
}) {
  const [report, setReport] = useState<WeeklyReport | null>(initial);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isPremium = tier === "premium";

  // Always use live server-computed data for charts and stats
  const s = liveSummary;
  const hasData = s.per_habit.length > 0 || s.total_scheduled > 0;

  const run = () =>
    startTransition(async () => {
      setError(null);
      const res = await generateWeeklyReport();
      if (!res.ok) { setError(res.error); return; }
      setReport(res.report);
    });

  if (!hasData) {
    return (
      <EmptyState
        icon={Sparkles}
        title="No habits logged yet"
        description="Start tracking habits on the dashboard, then come back here."
        action={
          <Button asChild>
            <a href="/dashboard">Go to dashboard</a>
          </Button>
        }
      />
    );
  }

  const thisRate = Math.round(s.completion_rate * 100);
  const prevRate = prevReport?.summary_json.completion_rate ?? null;
  const prevRatePct = prevRate !== null ? Math.round(prevRate * 100) : null;
  const delta = prevRatePct !== null ? thisRate - prevRatePct : null;
  const hasEnoughData = s.total_scheduled >= 7;

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary">Last 7 days</Badge>
          <Badge>{thisRate}% completion</Badge>
          {delta !== null && (
            <Badge
              variant={delta > 0 ? "default" : delta < 0 ? "destructive" : "secondary"}
              className="flex items-center gap-1"
            >
              {delta > 0 ? (
                <TrendingUp className="h-3 w-3" />
              ) : delta < 0 ? (
                <TrendingDown className="h-3 w-3" />
              ) : (
                <Minus className="h-3 w-3" />
              )}
              {delta > 0 ? "+" : ""}{delta}% vs last week
            </Badge>
          )}
        </div>
        <Button variant="outline" onClick={run} disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Re-run
        </Button>
      </div>

      {/* Low-data warning */}
      {!hasEnoughData && (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
            <p className="text-sm text-yellow-700 dark:text-yellow-400">
              Only {s.total_scheduled} habit logs this week — insights are most accurate after a full week of tracking.
            </p>
          </CardContent>
        </Card>
      )}

      {/* AI insight — shown only after Re-run generates one */}
      {report ? (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              AI insight
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm leading-relaxed">{report.ai_insight}</p>
            {report.recommended_next_step && (
              <div className="rounded-md border bg-background p-3 text-sm">
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary">
                  Next-week step
                </div>
                {report.recommended_next_step}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex items-center gap-3 p-4 text-sm text-muted-foreground">
            <Sparkles className="h-5 w-5 shrink-0 text-primary" />
            Hit <strong className="text-foreground mx-1">Re-run</strong> above to get a personalised AI summary of your week.
          </CardContent>
        </Card>
      )}

      {/* Stat tiles */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
        <StatTile label="Completed" value={s.total_completed} hint={`of ${s.total_scheduled} scheduled`} />
        <StatTile label="Skipped" value={s.total_skipped} hint="this week" muted />
        <StatTile
          label="Streak"
          value={s.streak_days}
          hint={s.streak_days === 1 ? "active day" : "active days"}
          icon={<Flame className="h-4 w-4 text-orange-500" />}
        />
        {prevRatePct !== null ? (
          <StatTile
            label="Last week"
            value={`${prevRatePct}%`}
            hint={delta === 0 ? "no change" : delta! > 0 ? `↑ ${delta}pp improvement` : `↓ ${Math.abs(delta!)}pp drop`}
            positive={delta !== null && delta > 0}
          />
        ) : (
          <StatTile label="Completion rate" value={`${thisRate}%`} hint="habits done vs scheduled" />
        )}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Per habit</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <PerHabitBar data={s.per_habit} />
            {s.per_habit.some((p) => p.streak !== undefined) && (
              <div className="divide-y rounded-md border text-sm">
                {s.per_habit.map((p) => (
                  <div key={p.habit_id} className="flex items-center justify-between px-3 py-2">
                    <span className="truncate text-muted-foreground max-w-[55%]">{p.title}</span>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-muted-foreground">{Math.round(p.rate * 100)}% this week</span>
                      {p.streak !== undefined && (
                        <span className={`flex items-center gap-1 text-xs font-medium ${p.streak > 0 ? "text-orange-500" : "text-muted-foreground"}`}>
                          <Flame className="h-3 w-3" />
                          {p.streak}d streak
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mood trend</CardTitle>
          </CardHeader>
          <CardContent>
            <MoodLine data={s.mood_trend} />
          </CardContent>
        </Card>
      </div>

      {/* Weekday vs weekend */}
      {(s.weekday_rate !== null || s.weekend_rate !== null) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Weekday vs weekend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">Mon – Fri</div>
                <div className="text-3xl font-semibold">
                  {s.weekday_rate !== null ? `${Math.round(s.weekday_rate * 100)}%` : "—"}
                </div>
                {s.weekday_rate !== null && (
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${Math.round(s.weekday_rate * 100)}%` }} />
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">Sat – Sun</div>
                <div className="text-3xl font-semibold">
                  {s.weekend_rate !== null ? `${Math.round(s.weekend_rate * 100)}%` : "—"}
                </div>
                {s.weekend_rate !== null && (
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${Math.round(s.weekend_rate * 100)}%` }} />
                  </div>
                )}
              </div>
            </div>
            {s.weekday_rate !== null && s.weekend_rate !== null && (
              <p className="mt-3 text-xs text-muted-foreground">
                {s.weekday_rate > s.weekend_rate
                  ? `You're ${Math.round((s.weekday_rate - s.weekend_rate) * 100)}pp stronger on weekdays. Structure is working for you.`
                  : s.weekend_rate > s.weekday_rate
                  ? `You're ${Math.round((s.weekend_rate - s.weekday_rate) * 100)}pp stronger on weekends. Less structured days suit you better.`
                  : "Consistent across the week."}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Category breakdown */}
      {s.per_habit.some((p) => p.category) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">By category</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryBar data={s.per_habit} />
          </CardContent>
        </Card>
      )}

      {/* Premium features */}
      {isPremium ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Best windows</CardTitle>
            </CardHeader>
            <CardContent>
              {s.best_windows.length > 0 ? (
                <BestWindowsBar data={s.best_windows} />
              ) : (
                <p className="text-sm text-muted-foreground">Not enough data yet.</p>
              )}
            </CardContent>
          </Card>
          <Card className="overflow-hidden border-none shadow-lg">
            <CardHeader className="bg-muted/50 pb-3">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Blockers this week
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 divide-y p-0 md:grid-cols-2 md:divide-x md:divide-y-0">
              <div className="p-5">
                <div className="mb-4 flex items-center gap-2 text-muted-foreground">
                  <ShieldAlert className="h-5 w-5" />
                  <span className="text-sm font-semibold">Friction notes</span>
                </div>
                <div className="space-y-3">
                  {s.excuses?.length ? (
                    s.excuses.map((e) => (
                      <div key={e} className="flex items-start gap-3 rounded-lg bg-muted/40 p-3 text-sm">
                        <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-muted-foreground shrink-0" />
                        <span className="text-foreground/80">{e}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground italic py-4 text-center">No friction notes this week.</p>
                  )}
                </div>
              </div>
              <div className="bg-muted/5 p-5">
                <div className="mb-4 flex items-center gap-2 text-primary">
                  <ShieldCheck className="h-5 w-5" />
                  <span className="text-sm font-semibold">Legitimate blockers</span>
                </div>
                <div className="space-y-3">
                  {s.valid_blockers?.length ? (
                    s.valid_blockers.map((b) => (
                      <div key={b} className="flex items-start gap-3 rounded-lg bg-background p-3 shadow-sm border border-border/50 text-sm">
                        <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                        <span className="text-foreground/80">{b}</span>
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <AlertCircle className="h-8 w-8 text-muted-foreground/30 mb-2" />
                      <p className="text-xs text-muted-foreground italic">No blockers logged this week.</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="p-5">
            <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="h-4 w-4 text-primary" />
              Unlock detailed reports
            </div>
            <p className="text-sm text-muted-foreground">
              {featureCopy("detailed_reports").description}
            </p>
            <Button asChild className="mt-3" size="sm">
              <a href="/pricing">Upgrade</a>
            </Button>
          </CardContent>
        </Card>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

function StatTile({
  label,
  value,
  hint,
  muted,
  positive,
  icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  muted?: boolean;
  positive?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">{label}</div>
          {icon}
        </div>
        <div className={`mt-1 text-2xl font-semibold ${muted ? "text-muted-foreground" : positive ? "text-primary" : ""}`}>
          {value}
        </div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}
