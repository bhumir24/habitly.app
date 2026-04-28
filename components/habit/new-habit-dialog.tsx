"use client";

import { useState, useTransition } from "react";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { CATEGORIES, DIFFICULTIES, FREQUENCIES, TIME_WINDOWS } from "@/lib/constants";
import { createHabit } from "@/actions/habits";
import type { HabitInput } from "@/lib/validations";

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

export function NewHabitDialog() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<HabitInput>(DEFAULTS);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const set = <K extends keyof HabitInput>(k: K, v: HabitInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { setError("Title is required"); return; }
    setError(null);
    startTransition(async () => {
      const res = await createHabit(form);
      if (!res.ok) { setError(res.error); return; }
      setOpen(false);
      setForm(DEFAULTS);
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setForm(DEFAULTS); setError(null); } }}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" />
          New Habit
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a new habit</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="nh-title">Title <span className="text-destructive">*</span></Label>
            <Input
              id="nh-title"
              placeholder="e.g. Morning run"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              maxLength={80}
              autoFocus
            />
          </div>

          {/* Purpose */}
          <div className="space-y-1.5">
            <Label htmlFor="nh-purpose">Purpose <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input
              id="nh-purpose"
              placeholder="Why does this habit matter?"
              value={form.purpose ?? ""}
              onChange={(e) => set("purpose", e.target.value)}
              maxLength={280}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Category */}
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => set("category", v as HabitInput["category"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Difficulty */}
            <div className="space-y-1.5">
              <Label>Difficulty</Label>
              <Select value={form.difficulty} onValueChange={(v) => set("difficulty", v as HabitInput["difficulty"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DIFFICULTIES.map((d) => (
                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Frequency */}
            <div className="space-y-1.5">
              <Label>Frequency</Label>
              <Select value={form.frequency} onValueChange={(v) => set("frequency", v as HabitInput["frequency"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FREQUENCIES.map((f) => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Preferred time */}
            <div className="space-y-1.5">
              <Label>Time of day</Label>
              <Select value={form.preferred_time} onValueChange={(v) => set("preferred_time", v as HabitInput["preferred_time"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIME_WINDOWS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Duration */}
          <div className="space-y-1.5">
            <Label htmlFor="nh-dur">Duration (minutes)</Label>
            <Input
              id="nh-dur"
              type="number"
              min={1}
              max={240}
              value={form.duration_minutes}
              onChange={(e) => set("duration_minutes", Math.max(1, Number(e.target.value)))}
              className="w-28"
            />
          </div>

          {/* Fallback */}
          <div className="space-y-1.5">
            <Label htmlFor="nh-fallback">Bad-day fallback <span className="text-muted-foreground text-xs">(optional)</span></Label>
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

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !form.title.trim()}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add habit
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
