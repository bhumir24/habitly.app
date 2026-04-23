"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Save, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CATEGORIES,
  DIFFICULTIES,
  FREQUENCIES,
  TIME_WINDOWS,
} from "@/lib/constants";
import { friendlyDay } from "@/lib/date";
import { updateHabit } from "@/actions/habits";
import type { Habit, HabitLog } from "@/types";

export function HabitDetail({
  habit,
  logs,
}: {
  habit: Habit;
  logs: HabitLog[];
}) {
  const router = useRouter();
  const [form, setForm] = useState<Habit>(habit);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const save = () =>
    startTransition(async () => {
      setError(null);
      const res = await updateHabit(habit.id, {
        title: form.title,
        purpose: form.purpose,
        description: form.description,
        category: form.category,
        frequency: form.frequency,
        preferred_time: form.preferred_time,
        duration_minutes: form.duration_minutes,
        difficulty: form.difficulty,
        fallback_habit: form.fallback_habit,
        is_active: form.is_active,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });

  const archive = () =>
    startTransition(async () => {
      const res = await updateHabit(habit.id, { is_active: false });
      if (res.ok) router.push("/dashboard");
    });

  const completed = logs.filter((l) => l.status === "completed").length;
  const skipped = logs.filter((l) => l.status === "skipped").length;
  const rate = completed + skipped ? completed / (completed + skipped) : 0;

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/dashboard">
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </Link>
      </Button>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Edit habit</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Title</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div>
              <Label>Purpose</Label>
              <Textarea
                value={form.purpose ?? ""}
                onChange={(e) => setForm({ ...form, purpose: e.target.value })}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <SelectField
                label="Category"
                value={form.category}
                options={CATEGORIES.map((c) => ({ v: c.value, l: c.label }))}
                onChange={(v) => setForm({ ...form, category: v as any })}
              />
              <SelectField
                label="Frequency"
                value={form.frequency}
                options={FREQUENCIES.map((c) => ({ v: c.value, l: c.label }))}
                onChange={(v) => setForm({ ...form, frequency: v as any })}
              />
              <SelectField
                label="Preferred time"
                value={form.preferred_time}
                options={TIME_WINDOWS.map((c) => ({ v: c.value, l: c.label }))}
                onChange={(v) => setForm({ ...form, preferred_time: v as any })}
              />
              <SelectField
                label="Difficulty"
                value={form.difficulty}
                options={DIFFICULTIES.map((c) => ({ v: c.value, l: c.label }))}
                onChange={(v) => setForm({ ...form, difficulty: v as any })}
              />
              <div>
                <Label>Duration (min)</Label>
                <Input
                  type="number"
                  min={1}
                  max={240}
                  value={form.duration_minutes}
                  onChange={(e) =>
                    setForm({ ...form, duration_minutes: Number(e.target.value) })
                  }
                />
              </div>
              <div>
                <Label>Bad-day fallback</Label>
                <Input
                  value={form.fallback_habit ?? ""}
                  onChange={(e) => setForm({ ...form, fallback_habit: e.target.value })}
                  placeholder="2-minute version"
                />
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={archive} disabled={isPending}>
                <Trash2 className="h-4 w-4" />
                Archive
              </Button>
              <Button onClick={save} disabled={isPending}>
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save changes
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div>
                <div className="text-xl font-semibold text-success">{completed}</div>
                <div className="text-xs text-muted-foreground">Completed</div>
              </div>
              <div>
                <div className="text-xl font-semibold text-muted-foreground">{skipped}</div>
                <div className="text-xs text-muted-foreground">Skipped</div>
              </div>
              <div>
                <div className="text-xl font-semibold">{Math.round(rate * 100)}%</div>
                <div className="text-xs text-muted-foreground">Rate</div>
              </div>
            </div>
            <div className="space-y-1.5">
              {logs.slice(0, 10).map((l) => (
                <div
                  key={l.id}
                  className="flex items-center justify-between rounded-md border px-3 py-1.5 text-sm"
                >
                  <span>{friendlyDay(l.completion_date)}</span>
                  <Badge
                    variant={
                      l.status === "completed"
                        ? "success"
                        : l.status === "skipped"
                          ? "secondary"
                          : "outline"
                    }
                    className="capitalize"
                  >
                    {l.status}
                  </Badge>
                </div>
              ))}
              {logs.length === 0 && (
                <p className="text-sm text-muted-foreground">No logs yet — complete today to start the streak.</p>
              )}
            </div>
          </CardContent>
        </Card>
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
      <Label className="mb-1 block">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
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
