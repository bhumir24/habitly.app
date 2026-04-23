"use client";

import { useState, useTransition } from "react";
import { Loader2, RefreshCw, Check, Pencil, Trash2, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FREQUENCIES, TIME_WINDOWS, DIFFICULTIES } from "@/lib/constants";
import { generatePlan, acceptPlan } from "@/actions/onboarding";
import type { GeneratedHabit, GeneratedPlan } from "@/types";

export function PlanReview({ initial }: { initial: GeneratedPlan }) {
  const [plan, setPlan] = useState<GeneratedPlan>(initial);
  const [editing, setEditing] = useState<number | null>(null);
  const [loading, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const regen = () =>
    startTransition(async () => {
      setError(null);
      const res = await generatePlan();
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setPlan(res.plan);
    });

  const accept = () =>
    startTransition(async () => {
      setError(null);
      const res = await acceptPlan(plan);
      if (res && "ok" in res && !res.ok) setError(res.error);
    });

  const updateHabit = (i: number, patch: Partial<GeneratedHabit>) => {
    setPlan((p) => ({
      ...p,
      habits: p.habits.map((h, idx) => (idx === i ? { ...h, ...patch } : h)),
    }));
  };

  const remove = (i: number) => {
    setPlan((p) => ({ ...p, habits: p.habits.filter((_, idx) => idx !== i) }));
  };

  return (
    <div className="space-y-5">
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex items-start gap-3 p-5">
          <Sparkles className="mt-0.5 h-5 w-5 text-primary" />
          <div className="text-sm leading-relaxed">{plan.rationale}</div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Your starter plan</h2>
        <Button variant="outline" onClick={regen} disabled={loading}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Regenerate
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {plan.habits.map((h, i) => (
          <Card key={i} className="relative">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base">
                  {editing === i ? (
                    <Input
                      value={h.title}
                      onChange={(e) => updateHabit(i, { title: e.target.value })}
                      className="h-8"
                    />
                  ) : (
                    h.title
                  )}
                </CardTitle>
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setEditing(editing === i ? null : i)}
                    aria-label="Edit"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => remove(i)}
                    aria-label="Remove"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{h.purpose}</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {editing === i ? (
                <div className="grid grid-cols-2 gap-2">
                  <SelectField
                    label="Frequency"
                    value={h.frequency}
                    options={FREQUENCIES.map((f) => ({ v: f.value, l: f.label }))}
                    onChange={(v) => updateHabit(i, { frequency: v as any })}
                  />
                  <SelectField
                    label="When"
                    value={h.preferred_time}
                    options={TIME_WINDOWS.map((f) => ({ v: f.value, l: f.label }))}
                    onChange={(v) => updateHabit(i, { preferred_time: v as any })}
                  />
                  <SelectField
                    label="Difficulty"
                    value={h.difficulty}
                    options={DIFFICULTIES.map((f) => ({ v: f.value, l: f.label }))}
                    onChange={(v) => updateHabit(i, { difficulty: v as any })}
                  />
                  <div>
                    <div className="mb-1 text-xs text-muted-foreground">Duration</div>
                    <Input
                      type="number"
                      min={1}
                      max={240}
                      value={h.duration_minutes}
                      onChange={(e) =>
                        updateHabit(i, { duration_minutes: Number(e.target.value) })
                      }
                      className="h-8"
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="secondary" className="capitalize">
                    {h.frequency.replace("_", " ")}
                  </Badge>
                  <Badge variant="secondary" className="capitalize">
                    {h.preferred_time.replace("_", " ")}
                  </Badge>
                  <Badge variant="secondary">{h.duration_minutes} min</Badge>
                  <Badge variant="outline" className="capitalize">
                    {h.difficulty}
                  </Badge>
                </div>
              )}
              <p className="rounded-md bg-muted/60 p-2 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Bad-day fallback: </span>
                {h.fallback_habit}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button onClick={accept} disabled={loading || plan.habits.length === 0}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Accept plan & continue
        </Button>
      </div>
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { v: string; l: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <div className="mb-1 text-xs text-muted-foreground">{label}</div>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.v} value={o.v}>
              {o.l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
