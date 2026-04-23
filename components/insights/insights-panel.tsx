"use client";

import { useState, useTransition } from "react";
import { Loader2, Sparkles, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PerHabitBar, MoodLine, BestWindowsBar } from "./charts";
import { generateWeeklyReport } from "@/actions/insights";
import { featureCopy } from "@/lib/feature-flags";
import type { PlanTier, WeeklyReport } from "@/types";
import { format, parseISO } from "date-fns";

export function InsightsPanel({
  initial,
  tier,
}: {
  initial: WeeklyReport | null;
  tier: PlanTier;
}) {
  const [report, setReport] = useState<WeeklyReport | null>(initial);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isPremium = tier === "premium";

  const run = () =>
    startTransition(async () => {
      setError(null);
      const res = await generateWeeklyReport();
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setReport(res.report);
    });

  if (!report) {
    return (
      <EmptyState
        icon={Sparkles}
        title="No weekly report yet"
        description="Generate one anytime after you've logged a few habits."
        action={
          <Button onClick={run} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Generate this week's report
          </Button>
        }
      />
    );
  }

  const s = report.summary_json;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            Week of {format(parseISO(report.week_start), "MMM d")}
          </Badge>
          <Badge>{Math.round(s.completion_rate * 100)}% completion</Badge>
        </div>
        <Button variant="outline" onClick={run} disabled={isPending}>
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Re-run
        </Button>
      </div>

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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatTile label="Completed" value={s.total_completed} hint={`of ${s.total_scheduled} scheduled`} />
        <StatTile label="Skipped" value={s.total_skipped} hint="this week" />
        <StatTile
          label="Mood avg"
          value={s.mood_avg != null ? s.mood_avg.toFixed(1) : "—"}
          hint="out of 5"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Per habit</CardTitle>
          </CardHeader>
          <CardContent>
            <PerHabitBar data={s.per_habit} />
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
                <p className="text-sm text-muted-foreground">
                  Not enough data yet.
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top blockers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {s.top_blockers.length ? (
                s.top_blockers.map((b) => (
                  <div key={b} className="rounded-md border p-2 text-sm">
                    {b}
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No blockers recorded — nice.
                </p>
              )}
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
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
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
