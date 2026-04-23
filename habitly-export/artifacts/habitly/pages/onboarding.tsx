import { useState } from "react";
import { useLocation } from "wouter";
import { useSaveOnboarding } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, ArrowRight, ArrowLeft, Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const GOALS = [
  { id: "fitness", label: "Fitness" },
  { id: "meditation", label: "Meditation" },
  { id: "reading", label: "Reading" },
  { id: "journaling", label: "Journaling" },
  { id: "sleep", label: "Better sleep" },
  { id: "nutrition", label: "Nutrition" },
  { id: "learning", label: "Learning" },
  { id: "creativity", label: "Creativity" },
  { id: "social", label: "Social connection" },
  { id: "focus", label: "Deep focus" },
];

const BLOCKERS = [
  { id: "stress", label: "Stress" },
  { id: "limited time", label: "Limited time" },
  { id: "motivation", label: "Motivation" },
  { id: "consistency", label: "Consistency" },
  { id: "distraction", label: "Distractions" },
  { id: "forgetfulness", label: "Forgetfulness" },
];

const ENERGY_LEVELS = [
  { id: "low", label: "Low", desc: "I often feel tired" },
  { id: "medium", label: "Medium", desc: "Typical day-to-day energy" },
  { id: "high", label: "High", desc: "Generally energetic" },
];

const LIFE_MODES = [
  { id: "student", label: "Student" },
  { id: "professional", label: "Professional" },
  { id: "parent", label: "Parent" },
  { id: "other", label: "Other" },
];

const STEPS = ["Goals", "Schedule", "Blockers", "About you"];

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [goals, setGoals] = useState<string[]>([]);
  const [dailyMinutes, setDailyMinutes] = useState(20);
  const [wakeTime, setWakeTime] = useState("07:00");
  const [sleepTime, setSleepTime] = useState("23:00");
  const [energyLevel, setEnergyLevel] = useState("medium");
  const [lifeMode, setLifeMode] = useState("professional");
  const [blockers, setBlockers] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  const saveOnboarding = useSaveOnboarding();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const toggleGoal = (id: string) =>
    setGoals((prev) => prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]);

  const toggleBlocker = (id: string) =>
    setBlockers((prev) => prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]);

  const handleSubmit = () => {
    saveOnboarding.mutate(
      {
        data: {
          goals,
          dailyMinutes,
          wakeTime,
          sleepTime,
          workBlock: "09:00-17:00",
          energyLevel: energyLevel as "low" | "medium" | "high",
          lifeMode: lifeMode as "student" | "professional" | "parent" | "other",
          blockers,
          notes,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries();
          setLocation("/dashboard");
        },
      }
    );
  };

  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-display font-semibold">Habitly</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Step {step + 1} of {STEPS.length}
        </p>
      </header>

      <div className="h-1 bg-muted">
        <div
          className="h-full bg-primary transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex-1 flex items-start justify-center p-6 pt-12">
        <div className="w-full max-w-lg">
          {step === 0 && (
            <div>
              <h1 className="text-2xl font-display font-semibold mb-2">What do you want to work on?</h1>
              <p className="text-muted-foreground mb-6 text-sm">Choose all that apply. Your AI plan will focus on these areas.</p>
              <div className="flex flex-wrap gap-2">
                {GOALS.map((goal) => (
                  <button
                    key={goal.id}
                    onClick={() => toggleGoal(goal.id)}
                    className={cn(
                      "px-4 py-2 rounded-full text-sm font-medium border transition-colors",
                      goals.includes(goal.id)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card border-card-border text-foreground hover:border-primary/40"
                    )}
                    data-testid={`goal-${goal.id}`}
                  >
                    {goal.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <h1 className="text-2xl font-display font-semibold mb-2">What does your day look like?</h1>
              <p className="text-muted-foreground mb-6 text-sm">We'll schedule habits around your natural rhythm.</p>
              <div className="space-y-5">
                <div>
                  <Label>Daily time available for habits</Label>
                  <div className="flex items-center gap-4 mt-2">
                    <input
                      type="range"
                      min={5}
                      max={120}
                      step={5}
                      value={dailyMinutes}
                      onChange={(e) => setDailyMinutes(Number(e.target.value))}
                      className="flex-1 accent-primary"
                    />
                    <span className="text-sm font-medium w-20 text-right">{dailyMinutes} min</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="wake">Wake time</Label>
                    <input
                      id="wake"
                      type="time"
                      value={wakeTime}
                      onChange={(e) => setWakeTime(e.target.value)}
                      className="mt-1.5 flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                  <div>
                    <Label htmlFor="sleep">Sleep time</Label>
                    <input
                      id="sleep"
                      type="time"
                      value={sleepTime}
                      onChange={(e) => setSleepTime(e.target.value)}
                      className="mt-1.5 flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h1 className="text-2xl font-display font-semibold mb-2">What gets in the way?</h1>
              <p className="text-muted-foreground mb-6 text-sm">Your AI coach will help you work around these.</p>
              <div className="flex flex-wrap gap-2">
                {BLOCKERS.map((blocker) => (
                  <button
                    key={blocker.id}
                    onClick={() => toggleBlocker(blocker.id)}
                    className={cn(
                      "px-4 py-2 rounded-full text-sm font-medium border transition-colors",
                      blockers.includes(blocker.id)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card border-card-border text-foreground hover:border-primary/40"
                    )}
                    data-testid={`blocker-${blocker.id}`}
                  >
                    {blocker.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h1 className="text-2xl font-display font-semibold mb-2">A little about you</h1>
              <p className="text-muted-foreground mb-6 text-sm">Help us personalize your habit style.</p>
              <div className="space-y-5">
                <div>
                  <Label className="mb-3 block">Energy level</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {ENERGY_LEVELS.map((e) => (
                      <button
                        key={e.id}
                        onClick={() => setEnergyLevel(e.id)}
                        className={cn(
                          "p-3 rounded-xl border text-left transition-colors",
                          energyLevel === e.id
                            ? "bg-primary/10 border-primary/40 text-primary"
                            : "bg-card border-card-border hover:border-primary/30"
                        )}
                        data-testid={`energy-${e.id}`}
                      >
                        <p className="text-sm font-medium">{e.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{e.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="mb-3 block">Life situation</Label>
                  <div className="flex flex-wrap gap-2">
                    {LIFE_MODES.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setLifeMode(m.id)}
                        className={cn(
                          "px-4 py-2 rounded-full text-sm font-medium border transition-colors",
                          lifeMode === m.id
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-card border-card-border hover:border-primary/40"
                        )}
                        data-testid={`lifemode-${m.id}`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label htmlFor="notes">Anything else? (optional)</Label>
                  <Textarea
                    id="notes"
                    placeholder="e.g. I travel often, I have a toddler..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="mt-1.5 resize-none"
                    rows={3}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mt-10">
            <Button
              variant="ghost"
              onClick={() => setStep((s) => s - 1)}
              disabled={step === 0}
              className="gap-2"
              data-testid="button-onboarding-back"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>

            {step < STEPS.length - 1 ? (
              <Button
                onClick={() => setStep((s) => s + 1)}
                disabled={step === 0 && goals.length === 0}
                className="gap-2"
                data-testid="button-onboarding-next"
              >
                Continue
                <ArrowRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={saveOnboarding.isPending}
                className="gap-2"
                data-testid="button-onboarding-submit"
              >
                {saveOnboarding.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating your plan...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generate my habit plan
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
