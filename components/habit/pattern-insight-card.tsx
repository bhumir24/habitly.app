import { TrendingUp, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface PatternData {
  worstDay: { name: string; skipRate: number } | null;
  bestWindow: string | null;
  totalLoggedDays: number;
}

export function PatternInsightCard({ pattern }: { pattern: PatternData }) {
  if (pattern.totalLoggedDays < 5) return null;
  if (!pattern.worstDay && !pattern.bestWindow) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-4 w-4 text-primary" />
          Your patterns
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {pattern.worstDay && (
          <div className="flex gap-2 rounded-lg bg-amber-50 p-3 text-amber-800 dark:bg-amber-950/20 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="text-sm">
              You skip most on <strong>{pattern.worstDay.name}</strong>{" "}
              ({Math.round(pattern.worstDay.skipRate * 100)}% skip rate). Try
              the fallback version that day instead of skipping entirely.
            </p>
          </div>
        )}
        {pattern.bestWindow && (
          <div className="flex gap-2 rounded-lg bg-emerald-50 p-3 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400">
            <TrendingUp className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="text-sm">
              Your strongest window is{" "}
              <strong>{pattern.bestWindow.replace(/_/g, " ")}</strong>.
              Schedule your highest-priority habits there.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
