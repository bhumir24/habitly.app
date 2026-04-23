"use client";

import { useState, useTransition } from "react";
import { Sparkles, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { applyAdaptation } from "@/actions/habits";
import type { Adaptation } from "@/types";

const KIND_LABEL: Record<Adaptation["kind"], string> = {
  simpler_version: "Simpler version",
  micro_substitute: "Micro substitute",
  alternate_time: "Alternate time",
  reduced_frequency: "Reduced frequency",
  recovery_day: "Recovery day",
  progression: "Progression",
};

export function AdaptationsPanel({ adaptations }: { adaptations: Adaptation[] }) {
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  if (!adaptations.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" />
          Smart adaptations
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Based on your last 3 weeks of activity.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {adaptations.map((a, i) => {
          const key = `${a.habit_id}-${a.kind}-${i}`;
          const wasApplied = applied.has(key);
          return (
            <div
              key={key}
              className="flex flex-col gap-2 rounded-lg border p-3 md:flex-row md:items-center md:justify-between"
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{KIND_LABEL[a.kind]}</Badge>
                  <span className="text-xs text-muted-foreground">{a.reason}</span>
                </div>
                <p className="text-sm">{a.suggestion}</p>
              </div>
              {a.kind === "recovery_day" ? (
                <Badge variant="secondary">Informational</Badge>
              ) : wasApplied ? (
                <Badge variant="success">
                  <Check className="mr-1 h-3 w-3" />
                  Applied
                </Badge>
              ) : (
                <Button
                  size="sm"
                  disabled={isPending}
                  onClick={() =>
                    startTransition(async () => {
                      const res = await applyAdaptation(a);
                      if (res.ok) setApplied((s) => new Set(s).add(key));
                    })
                  }
                >
                  Apply
                </Button>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
