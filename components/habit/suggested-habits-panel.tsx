"use client";

import { useState, useTransition } from "react";
import { Plus, RefreshCw, Check, Loader2, Clock, Zap, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { reactivateHabit, addGeneratedHabit } from "@/actions/habits";
import { generatePlan } from "@/actions/onboarding";
import type { Habit, GeneratedHabit } from "@/types";

type ExistingSuggestion = { kind: "existing"; habit: Habit };
type GeneratedSuggestion = { kind: "generated"; habit: GeneratedHabit };
type Suggestion = ExistingSuggestion | GeneratedSuggestion;

const DIFF_COLOR: Record<string, string> = {
  micro: "bg-emerald-500/10 text-emerald-600",
  easy: "bg-sky-500/10 text-sky-600",
  medium: "bg-amber-500/10 text-amber-600",
  hard: "bg-rose-500/10 text-rose-600",
};

function suggestionKey(s: Suggestion, i: number) {
  return s.kind === "existing" ? s.habit.id : `gen-${i}-${s.habit.title}`;
}

export function SuggestedHabitsPanel({ inactive }: { inactive: Habit[] }) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>(
    inactive.map((h) => ({ kind: "existing", habit: h }))
  );
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, startRefresh] = useTransition();

  const refresh = () =>
    startRefresh(async () => {
      setError(null);
      const res = await generatePlan();
      if (!res.ok) { setError(res.error); return; }
      setSuggestions(res.plan.habits.map((h) => ({ kind: "generated", habit: h })));
      setAdded(new Set());
    });

  const handleAdd = async (s: Suggestion, key: string) => {
    setAdding((prev) => new Set(prev).add(key));
    const res =
      s.kind === "existing"
        ? await reactivateHabit(s.habit.id)
        : await addGeneratedHabit(s.habit);
    setAdding((prev) => { const n = new Set(prev); n.delete(key); return n; });
    if (!res.ok) { setError(res.error); return; }
    setAdded((prev) => new Set(prev).add(key));
  };

  const pending = suggestions.filter((s, i) => !added.has(suggestionKey(s, i)));

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            Add habits
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={refresh}
            disabled={isRefreshing}
            className="h-7 px-2 text-xs"
          >
            {isRefreshing ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            {suggestions.length === 0 ? "Generate" : "Refresh"}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-2">
        {suggestions.length === 0 && !isRefreshing && (
          <p className="text-xs text-muted-foreground">
            Click Refresh to get AI-generated habit suggestions based on your plan.
          </p>
        )}

        {isRefreshing && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
            <Loader2 className="h-3 w-3 animate-spin" />
            Generating suggestions…
          </div>
        )}

        {!isRefreshing && suggestions.map((s, i) => {
          const key = suggestionKey(s, i);
          const h = s.habit;
          const isAdded = added.has(key);
          const isAdding = adding.has(key);

          return (
            <div
              key={key}
              className={cn(
                "flex items-start justify-between gap-3 rounded-lg border p-3 transition-colors",
                isAdded && "border-success/30 bg-success/5"
              )}
            >
              <div className="min-w-0 flex-1 space-y-1">
                <p className={cn("text-sm font-medium leading-tight", isAdded && "text-muted-foreground line-through")}>
                  {h.title}
                </p>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                    <Clock className="mr-0.5 h-2.5 w-2.5" />
                    {h.duration_minutes}m · {h.preferred_time.replace(/_/g, " ")}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn("h-4 px-1.5 text-[10px] capitalize", DIFF_COLOR[h.difficulty])}
                  >
                    <Zap className="mr-0.5 h-2.5 w-2.5" />
                    {h.difficulty}
                  </Badge>
                </div>
              </div>

              <Button
                size="icon"
                variant={isAdded ? "success" : "outline"}
                className="h-7 w-7 shrink-0"
                onClick={() => !isAdded && handleAdd(s, key)}
                disabled={isAdded || isAdding}
                aria-label={isAdded ? "Added" : "Add habit"}
              >
                {isAdding ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : isAdded ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Plus className="h-3 w-3" />
                )}
              </Button>
            </div>
          );
        })}

        {pending.length === 0 && added.size > 0 && (
          <p className="text-xs text-muted-foreground pt-1">
            All suggestions added. Click Refresh for more.
          </p>
        )}

        {error && <p className="text-xs text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
