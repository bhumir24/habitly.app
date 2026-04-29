"use client";

import { useState, useTransition } from "react";
import { Loader2, Sparkles, RefreshCw, Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PerHabitBar, MoodLine, BestWindowsBar } from "./charts";
import { generateWeeklyReport } from "@/actions/insights";
import type { PlanTier, WeeklyReport, WeeklySummary } from "@/types";

export function InsightsPanel({
  initial,
  liveSummary,
  tier,
}: {
  initial: WeeklyReport | null;
  liveSummary: WeeklySummary;
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">Last 7 days</Badge>
          <Badge>{Math.round(s.completion_rate * 100)}% completion</Badge>
        </div>
        <Button variant="outline" onClick={run} disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Re-run
        </Button>
      </div>

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
            Hit <strong className="text-foreground">Re-run</strong> above to get a personalized AI summary of your week.
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatTile label="Completed" value={s.total_completed} hint={`of ${s.total_scheduled} scheduled`} />
        <StatTile label="Skipped" value={s.total_skipped} hint="this week" />
        <StatTile label="Mood avg" value={s.mood_avg != null ? s.mood_avg.toFixed(1) : "—"} hint="out of 5" />
      </div>

      {s.per_habit.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Habits this period</CardTitle>
          </CardHeader>
          <CardContent>
            <PerHabitBar data={s.per_habit} />
          </CardContent>
        </Card>
      )}

      {isPremium ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Mood trend</CardTitle>
            </CardHeader>
            <CardContent>
              <MoodLine data={s.mood_trend} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Best windows</CardTitle>
            </CardHeader>
            <CardContent>
              {s.best_windows.length > 0 ? (
                <BestWindowsBar data={s.best_windows} />
              ) : (
                <div className="flex h-48 items-center justify-center rounded-md border border-dashed">
                  <p className="text-center text-sm text-muted-foreground">
                    Not enough data yet.<br />Log more habits to see your best time windows.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="p-5">
            <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
              <Lock className="h-4 w-4 text-primary" />
              Mood trends &amp; best windows
            </div>
            <p className="mb-3 text-sm text-muted-foreground">
              See how your mood correlates with habits and which time windows have the highest completion rate.
            </p>
            <Button asChild size="sm">
              <a href="/pricing">Upgrade to Premium</a>
            </Button>
          </CardContent>
        </Card>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

function StatTile({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-semibold">{value}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}
