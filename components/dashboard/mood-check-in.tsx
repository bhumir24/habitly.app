"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { saveDailyMood } from "@/actions/mood";
import { cn } from "@/lib/utils";

const MOODS = [
  { value: 1, emoji: "😫", label: "Rough" },
  { value: 2, emoji: "😕", label: "Low" },
  { value: 3, emoji: "😐", label: "Okay" },
  { value: 4, emoji: "😊", label: "Good" },
  { value: 5, emoji: "🤩", label: "Great" },
];

export function MoodCheckIn({ todayMood }: { todayMood: number | null }) {
  const [selected, setSelected] = useState<number | null>(todayMood);
  const [isPending, startTransition] = useTransition();

  const pick = (mood: number) => {
    setSelected(mood);
    startTransition(async () => {
      await saveDailyMood(mood);
    });
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          How are you feeling today?
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex justify-between gap-1">
          {MOODS.map((m) => (
            <button
              key={m.value}
              type="button"
              disabled={isPending}
              onClick={() => pick(m.value)}
              className={cn(
                "flex flex-1 flex-col items-center rounded-lg py-2 text-center transition",
                selected === m.value
                  ? "bg-primary/10 ring-1 ring-primary"
                  : "hover:bg-accent"
              )}
            >
              <span className="text-xl">{m.emoji}</span>
              <span className="mt-0.5 text-[10px] text-muted-foreground">{m.label}</span>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
