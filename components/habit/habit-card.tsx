"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Check,
  Clock,
  SkipForward,
  MoreHorizontal,
  Flame,
  Zap,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { logHabit } from "@/actions/habits";
import { cn } from "@/lib/utils";
import type { Habit, HabitLog } from "@/types";

const DIFF_COLOR: Record<Habit["difficulty"], string> = {
  micro: "bg-emerald-500/10 text-emerald-600",
  easy: "bg-sky-500/10 text-sky-600",
  medium: "bg-amber-500/10 text-amber-600",
  hard: "bg-rose-500/10 text-rose-600",
};

export function HabitCard({
  habit,
  log,
}: {
  habit: Habit;
  log?: HabitLog | null;
}) {
  const [showBlocker, setShowBlocker] = useState(false);
  const [blocker, setBlocker] = useState("");
  const [isPending, startTransition] = useTransition();
  const status = log?.status;

  const done = status === "completed";
  const skipped = status === "skipped";

  const handle = (next: "completed" | "skipped") => {
    startTransition(async () => {
      await logHabit({
        habit_id: habit.id,
        status: next,
        blocker_note: next === "skipped" ? blocker || null : null,
      });
      setShowBlocker(false);
      setBlocker("");
    });
  };

  return (
    <Card
      className={cn(
        "group transition-all hover:shadow-md",
        done && "bg-success/5 border-success/40",
        skipped && "bg-muted/50"
      )}
    >
      <CardContent className="flex items-start gap-4 p-4">
        <Button
          size="icon"
          variant={done ? "success" : "outline"}
          className={cn("h-10 w-10 shrink-0 rounded-full", done && "shadow-sm")}
          onClick={() => handle("completed")}
          disabled={isPending}
          aria-label={done ? "Completed" : "Mark complete"}
        >
          <Check className={cn("h-4 w-4", !done && "opacity-60")} />
        </Button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/habit/${habit.id}`}
              className={cn(
                "truncate text-sm font-semibold hover:underline",
                done && "text-muted-foreground line-through decoration-1",
                skipped && "text-muted-foreground"
              )}
            >
              {habit.title}
            </Link>
            <Badge variant="outline" className={cn("capitalize", DIFF_COLOR[habit.difficulty])}>
              <Zap className="mr-1 h-3 w-3" />
              {habit.difficulty}
            </Badge>
            <Badge variant="secondary" className="capitalize">
              <Clock className="mr-1 h-3 w-3" />
              {habit.duration_minutes}m · {habit.preferred_time.replace("_", " ")}
            </Badge>
          </div>
          {habit.purpose && (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
              {habit.purpose}
            </p>
          )}
          {habit.fallback_habit && (
            <p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
              <Flame className="h-3 w-3 text-amber-500" />
              Micro fallback: {habit.fallback_habit}
            </p>
          )}

          {showBlocker && (
            <div className="mt-3 space-y-2 animate-fade-in">
              <Textarea
                placeholder="What got in the way? (optional)"
                value={blocker}
                onChange={(e) => setBlocker(e.target.value)}
                rows={2}
                className="text-sm"
              />
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => handle("skipped")} disabled={isPending}>
                  Skip for today
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowBlocker(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

        {!showBlocker && (
          <div className="flex shrink-0 items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              aria-label="Skip"
              onClick={() => setShowBlocker(true)}
              disabled={isPending}
            >
              <SkipForward className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" asChild aria-label="More">
              <Link href={`/habit/${habit.id}`}>
                <MoreHorizontal className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
