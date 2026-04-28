"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  ENERGY_LEVELS,
  GOAL_SUGGESTIONS,
  LIFE_MODES,
  TIME_WINDOWS,
  COMMON_BLOCKERS,
} from "@/lib/constants";
import type {
  EnergyLevel,
  LifeMode,
  TimeOfDay,
} from "@/types";
import { saveOnboarding } from "@/actions/onboarding";

type State = {
  goals: string[];
  availability_min: number;
  routine: { wake?: string; sleep?: string; work_block?: string; life_modes?: LifeMode[] };
  energy_level: EnergyLevel;
  life_modes: LifeMode[];
  preferred_times: TimeOfDay[];
  blockers: string[];
  notes: string;
};

type WizardInitial = Partial<State> & {
  life_mode?: LifeMode;
};

const STEPS = ["Goals", "Time", "Routine", "Energy", "Life mode", "Blockers"];

export function OnboardingWizard({ initial }: { initial?: WizardInitial }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [s, setS] = useState<State>({
    goals: initial?.goals ?? [],
    availability_min: initial?.availability_min ?? 30,
    routine: initial?.routine ?? { wake: "07:00", sleep: "23:00" },
    energy_level: initial?.energy_level ?? "medium",
    life_modes:
      initial?.routine?.life_modes && initial.routine.life_modes.length > 0
        ? initial.routine.life_modes
        : [initial?.life_mode ?? "flexible"],
    preferred_times: initial?.preferred_times ?? ["morning"],
    blockers: initial?.blockers ?? [],
    notes: initial?.notes ?? "",
  });
  const [customGoal, setCustomGoal] = useState("");
  const MAX_GOALS = 10;

  const toggle = <T,>(list: T[], v: T): T[] =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

  const next = () => setStep((i) => Math.min(i + 1, STEPS.length - 1));
  const back = () => setStep((i) => Math.max(i - 1, 0));

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const res = await saveOnboarding({
        goals: s.goals,
        availability_min: s.availability_min,
        routine: { ...s.routine, life_modes: s.life_modes },
        energy_level: s.energy_level,
        life_mode: s.life_modes[0] ?? "flexible",
        preferred_times: s.preferred_times,
        blockers: s.blockers,
        notes: s.notes || null,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push("/plan-review");
    });
  };

  const canAdvance = (() => {
    switch (step) {
      case 0:
        return s.goals.length >= 1;
      case 1:
        return s.availability_min >= 5 && s.preferred_times.length >= 1;
      case 4:
        return s.life_modes.length >= 1;
      default:
        return true;
    }
  })();

  return (
    <Card className="overflow-hidden">
      <div className="border-b p-4">
        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Step {step + 1} of {STEPS.length}
          </span>
          <span>{STEPS[step]}</span>
        </div>
        <Progress value={((step + 1) / STEPS.length) * 100} />
      </div>

      <CardContent className="space-y-6 p-6">
        {step === 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">What do you want to work on?</h2>
            <p className="text-sm text-muted-foreground">
              Pick 1–10. Your AI plan starts from these.
            </p>
            <div className="flex flex-wrap gap-2">
              {GOAL_SUGGESTIONS.map((g) => (
                <Chip
                  key={g}
                  active={s.goals.includes(g)}
                  disabled={!s.goals.includes(g) && s.goals.length >= MAX_GOALS}
                  onClick={() => {
                    if (!s.goals.includes(g) && s.goals.length >= MAX_GOALS) return;
                    setS({ ...s, goals: toggle(s.goals, g) });
                  }}
                >
                  {g}
                </Chip>
              ))}
              {s.goals
                .filter((g) => !GOAL_SUGGESTIONS.includes(g))
                .map((g) => (
                  <Chip
                    key={g}
                    active
                    onClick={() => setS({ ...s, goals: toggle(s.goals, g) })}
                  >
                    {g}
                  </Chip>
                ))}
            </div>
            <div className="flex gap-2 pt-1">
              <Input
                value={customGoal}
                onChange={(e) => setCustomGoal(e.target.value)}
                placeholder="Add your own (e.g. learn Spanish)"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && customGoal.trim()) {
                    if (s.goals.length >= MAX_GOALS) return;
                    setS({ ...s, goals: [...s.goals, customGoal.trim()] });
                    setCustomGoal("");
                  }
                }}
              />
              <Button
                variant="outline"
                disabled={s.goals.length >= MAX_GOALS}
                onClick={() => {
                  if (!customGoal.trim()) return;
                  if (s.goals.length >= MAX_GOALS) return;
                  setS({ ...s, goals: [...s.goals, customGoal.trim()] });
                  setCustomGoal("");
                }}
              >
                Add
              </Button>
            </div>
            {s.goals.length >= MAX_GOALS && (
              <p className="text-xs text-muted-foreground">
                You can select up to {MAX_GOALS} goals.
              </p>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold">How much time per day?</h2>
              <p className="text-sm text-muted-foreground">
                {"Be realistic — we'll never exceed this."}
              </p>
              <div className="mt-3 flex items-center gap-3">
                <input
                  type="range"
                  min={10}
                  max={120}
                  step={5}
                  value={s.availability_min}
                  onChange={(e) =>
                    setS({ ...s, availability_min: Number(e.target.value) })
                  }
                  className="h-2 flex-1 cursor-pointer appearance-none rounded-lg bg-secondary accent-[hsl(var(--primary))]"
                />
                <div className="w-20 text-right text-sm font-semibold">
                  {s.availability_min} min
                </div>
              </div>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold">Preferred time windows</h3>
              <div className="flex flex-wrap gap-2">
                {TIME_WINDOWS.map((t) => (
                  <Chip
                    key={t.value}
                    active={s.preferred_times.includes(t.value)}
                    onClick={() =>
                      setS({
                        ...s,
                        preferred_times: toggle(s.preferred_times, t.value),
                      })
                    }
                  >
                    {t.label}
                  </Chip>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Your rough routine</h2>
            <p className="text-sm text-muted-foreground">
              Helps us slot habits outside your busy blocks.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Wake up">
                <Input
                  type="time"
                  value={s.routine.wake ?? ""}
                  onChange={(e) =>
                    setS({ ...s, routine: { ...s.routine, wake: e.target.value } })
                  }
                />
              </Field>
              <Field label="Sleep">
                <Input
                  type="time"
                  value={s.routine.sleep ?? ""}
                  onChange={(e) =>
                    setS({ ...s, routine: { ...s.routine, sleep: e.target.value } })
                  }
                />
              </Field>
              <Field label="Work/Study block">
                <Input
                  placeholder="09:00-18:00"
                  value={s.routine.work_block ?? ""}
                  onChange={(e) =>
                    setS({
                      ...s,
                      routine: { ...s.routine, work_block: e.target.value },
                    })
                  }
                />
              </Field>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Your energy baseline</h2>
            <p className="text-sm text-muted-foreground">
              {"We'll tune habit difficulty to this."}
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {ENERGY_LEVELS.map((e) => (
                <OptionCard
                  key={e.value}
                  title={e.label}
                  hint={e.hint}
                  active={s.energy_level === e.value}
                  onClick={() => setS({ ...s, energy_level: e.value })}
                />
              ))}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Which best describes you?</h2>
            <p className="text-sm text-muted-foreground">
              Pick one or more. We will plan for your combined context.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {LIFE_MODES.map((m) => (
                <OptionCard
                  key={m.value}
                  title={m.label}
                  hint={m.hint}
                  active={s.life_modes.includes(m.value)}
                  onClick={() => setS({ ...s, life_modes: toggle(s.life_modes, m.value) })}
                />
              ))}
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">What gets in the way?</h2>
              <p className="text-sm text-muted-foreground">
                Select common blockers so we can plan around them.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {COMMON_BLOCKERS.map((b) => (
                  <Chip
                    key={b}
                    active={s.blockers.includes(b)}
                    onClick={() => setS({ ...s, blockers: toggle(s.blockers, b) })}
                  >
                    {b}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <h3 className="mb-1 text-sm font-semibold">Anything else?</h3>
              <Textarea
                placeholder="Optional — context your coach should know."
                value={s.notes}
                onChange={(e) => setS({ ...s, notes: e.target.value })}
              />
            </div>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>

      <div className="flex items-center justify-between border-t bg-muted/30 px-6 py-3">
        <Button variant="ghost" onClick={back} disabled={step === 0 || isPending}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={next} disabled={!canAdvance}>
            Continue
            <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={submit} disabled={isPending}>
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Generate my plan
          </Button>
        )}
      </div>
    </Card>
  );
}

function Chip({
  children,
  active,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-sm transition",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "hover:border-foreground/30 hover:bg-accent",
        disabled && "cursor-not-allowed opacity-50 hover:border-inherit hover:bg-transparent"
      )}
    >
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function OptionCard({
  title,
  hint,
  active,
  onClick,
}: {
  title: string;
  hint: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-start gap-1 rounded-lg border p-4 text-left transition",
        active
          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
          : "hover:border-foreground/20 hover:bg-accent"
      )}
    >
      <div className="flex w-full items-center justify-between">
        <span className="text-sm font-semibold">{title}</span>
        {active && (
          <Badge variant="default" className="text-[10px]">
            Selected
          </Badge>
        )}
      </div>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </button>
  );
}
