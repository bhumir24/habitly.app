"use client";

import { useState, useTransition } from "react";
import { Plus, Loader2, RefreshCw, Check, Clock, Zap, Sparkles, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CATEGORIES, DIFFICULTIES, FREQUENCIES, TIME_WINDOWS } from "@/lib/constants";
import { createHabit, reactivateHabit, addGeneratedHabit } from "@/actions/habits";
import { Switch } from "@/components/ui/switch";
import { generatePlan } from "@/actions/onboarding";
import { cn } from "@/lib/utils";
import type { HabitInput } from "@/lib/validations";
import type { Habit, GeneratedHabit } from "@/types";

const IDEAL_TIMES: Record<string, string> = {
  early_morning: "06:30", morning: "08:00", midday: "12:30",
  afternoon: "15:30", evening: "19:00", night: "22:30", any: "09:00",
};

const DEFAULTS: HabitInput = {
  title: "",
  category: "health",
  frequency: "daily",
  preferred_time: "morning",
  duration_minutes: 10,
  difficulty: "easy",
  purpose: "",
  fallback_habit: "",
};

const DIFF_COLOR: Record<string, string> = {
  micro: "bg-emerald-500/10 text-emerald-600",
  easy: "bg-sky-500/10 text-sky-600",
  medium: "bg-amber-500/10 text-amber-600",
  hard: "bg-rose-500/10 text-rose-600",
};

type AISuggestion =
  | { kind: "existing"; habit: Habit }
  | { kind: "generated"; habit: GeneratedHabit };

function suggestionKey(s: AISuggestion, i: number) {
  return s.kind === "existing" ? s.habit.id : `gen-${i}-${s.habit.title}`;
}

export function NewHabitDialog({ suggestions = [] }: { suggestions?: Habit[] }) {
  const [open, setOpen] = useState(false);

  // Custom tab state
  const [form, setForm] = useState<HabitInput>(DEFAULTS);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPendingForm, startFormTransition] = useTransition();
  const [remind, setRemind] = useState(false);
  const [remindAt, setRemindAt] = useState("08:00");

  // AI tab state
  const [aiList, setAiList] = useState<AISuggestion[]>(
    suggestions.map((h) => ({ kind: "existing", habit: h }))
  );
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState<Set<string>>(new Set());
  const [aiError, setAiError] = useState<string | null>(null);
  const [isRefreshing, startRefresh] = useTransition();

  const resetDialog = () => {
    setForm(DEFAULTS);
    setFormError(null);
    setAiError(null);
    setAdded(new Set());
    setRemind(false);
    setRemindAt("08:00");
  };

  const set = <K extends keyof HabitInput>(k: K, v: HabitInput[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (k === "preferred_time") {
      setRemindAt(IDEAL_TIMES[v as string] ?? "09:00");
    }
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { setFormError("Title is required"); return; }
    setFormError(null);
    startFormTransition(async () => {
      const res = await createHabit(
        form,
        remind ? { enabled: true, remindAt } : undefined
      );
      if (!res.ok) { setFormError(res.error); return; }
      setOpen(false);
      setForm(DEFAULTS);
    });
  };

  const refresh = () =>
    startRefresh(async () => {
      setAiError(null);
      const res = await generatePlan();
      if (!res.ok) { setAiError(res.error); return; }
      setAiList(res.plan.habits.map((h) => ({ kind: "generated", habit: h })));
      setAdded(new Set());
    });

  const handleAddAI = async (s: AISuggestion, key: string) => {
    setAdding((p) => new Set(p).add(key));
    const res =
      s.kind === "existing"
        ? await reactivateHabit(s.habit.id)
        : await addGeneratedHabit(s.habit);
    setAdding((p) => { const n = new Set(p); n.delete(key); return n; });
    if (!res.ok) { setAiError(res.error); return; }
    setAdded((p) => new Set(p).add(key));
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetDialog(); }}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" />
          New Habit
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a habit</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="custom" className="pt-1">
          <TabsList className="w-full">
            <TabsTrigger value="custom" className="flex-1">Custom</TabsTrigger>
            <TabsTrigger value="ai" className="flex-1">
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              AI Suggestions
            </TabsTrigger>
          </TabsList>

          {/* ── Custom tab ── */}
          <TabsContent value="custom">
            <form onSubmit={handleCustomSubmit} className="space-y-4 pt-1">
              <div className="space-y-1.5">
                <Label htmlFor="nh-title">
                  Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="nh-title"
                  placeholder="e.g. Morning run"
                  value={form.title}
                  onChange={(e) => set("title", e.target.value)}
                  maxLength={80}
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="nh-purpose">
                  Purpose{" "}
                  <span className="text-xs text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="nh-purpose"
                  placeholder="Why does this habit matter?"
                  value={form.purpose ?? ""}
                  onChange={(e) => set("purpose", e.target.value)}
                  maxLength={280}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <Select
                    value={form.category}
                    onValueChange={(v) => set("category", v as HabitInput["category"])}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Difficulty</Label>
                  <Select
                    value={form.difficulty}
                    onValueChange={(v) => set("difficulty", v as HabitInput["difficulty"])}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DIFFICULTIES.map((d) => (
                        <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Frequency</Label>
                  <Select
                    value={form.frequency}
                    onValueChange={(v) => set("frequency", v as HabitInput["frequency"])}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FREQUENCIES.map((f) => (
                        <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Time of day</Label>
                  <Select
                    value={form.preferred_time}
                    onValueChange={(v) => set("preferred_time", v as HabitInput["preferred_time"])}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TIME_WINDOWS.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Duration (hours + mins)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="nh-dur-hours"
                    type="number"
                    min={0}
                    max={4}
                    value={Math.floor(form.duration_minutes / 60)}
                    onChange={(e) => {
                      const hours = Math.max(0, Math.min(4, Number(e.target.value || 0)));
                      const mins = form.duration_minutes % 60;
                      const total = Math.max(1, Math.min(240, hours * 60 + mins));
                      set("duration_minutes", total);
                    }}
                    className="w-20"
                  />
                  <span className="text-xs text-muted-foreground">h</span>
                  <Input
                    id="nh-dur-mins"
                    type="number"
                    min={0}
                    max={59}
                    value={form.duration_minutes % 60}
                    onChange={(e) => {
                      const mins = Math.max(0, Math.min(59, Number(e.target.value || 0)));
                      const hours = Math.floor(form.duration_minutes / 60);
                      const total = Math.max(1, Math.min(240, hours * 60 + mins));
                      set("duration_minutes", total);
                    }}
                    className="w-20"
                  />
                  <span className="text-xs text-muted-foreground">m</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="nh-fallback">
                  Bad-day fallback{" "}
                  <span className="text-xs text-muted-foreground">(optional)</span>
                </Label>
                <Textarea
                  id="nh-fallback"
                  placeholder="What's the 2-minute version on a rough day?"
                  value={form.fallback_habit ?? ""}
                  onChange={(e) => set("fallback_habit", e.target.value)}
                  rows={2}
                  maxLength={140}
                  className="resize-none text-sm"
                />
              </div>

              {/* Reminder toggle */}
              <div className="flex items-center justify-between rounded-md border px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <Bell className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm">Send me a reminder</span>
                </div>
                <div className="flex items-center gap-2">
                  {remind && (
                    <input
                      type="time"
                      value={remindAt}
                      onChange={(e) => setRemindAt(e.target.value)}
                      className="h-8 rounded-md border px-2 text-sm"
                    />
                  )}
                  <Switch
                    checked={remind}
                    onCheckedChange={(v) => {
                      setRemind(v);
                      if (v) setRemindAt(IDEAL_TIMES[form.preferred_time] ?? "09:00");
                    }}
                  />
                </div>
              </div>

              {formError && <p className="text-sm text-destructive">{formError}</p>}

              <div className="flex justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={isPendingForm}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isPendingForm || !form.title.trim()}>
                  {isPendingForm ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  Add habit
                </Button>
              </div>
            </form>
          </TabsContent>

          {/* ── AI Suggestions tab ── */}
          <TabsContent value="ai" className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Tailored to your goals and schedule.
              </p>
              <Button
                variant="outline"
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
                {aiList.length === 0 ? "Generate" : "Refresh"}
              </Button>
            </div>

            {isRefreshing && (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating suggestions…
              </div>
            )}

            {!isRefreshing && aiList.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Click Generate to get AI habit recommendations based on your plan.
              </p>
            )}

            {!isRefreshing &&
              aiList.map((s, i) => {
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
                      <p
                        className={cn(
                          "text-sm font-medium leading-tight",
                          isAdded && "text-muted-foreground line-through"
                        )}
                      >
                        {h.title}
                      </p>
                      {"purpose" in h && h.purpose && (
                        <p className="line-clamp-1 text-xs text-muted-foreground">
                          {h.purpose}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                          <Clock className="mr-0.5 h-2.5 w-2.5" />
                          {h.duration_minutes}m · {h.preferred_time.replace(/_/g, " ")}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={cn(
                            "h-4 px-1.5 text-[10px] capitalize",
                            DIFF_COLOR[h.difficulty]
                          )}
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
                      onClick={() => !isAdded && handleAddAI(s, key)}
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

            {!isRefreshing && added.size > 0 && added.size === aiList.length && (
              <p className="pt-1 text-center text-xs text-muted-foreground">
                All suggestions added. Click Refresh for more.
              </p>
            )}

            {aiError && <p className="text-sm text-destructive">{aiError}</p>}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
