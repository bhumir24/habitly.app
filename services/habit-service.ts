// Pure helpers around habit/log collections. DB-agnostic.
import type { Habit, HabitLog, TimeOfDay, WeeklySummary } from "@/types";
import { isHabitScheduledToday, mondayOf, toISODate } from "@/lib/date";
import { addDays } from "date-fns";

export function habitsDueToday(habits: Habit[], date: Date = new Date()) {
  return habits.filter(
    (h) => h.is_active && isHabitScheduledToday(h.frequency, h.custom_days, date)
  );
}

export function logsByDate(logs: HabitLog[]) {
  const m = new Map<string, HabitLog[]>();
  for (const l of logs) {
    const arr = m.get(l.completion_date) ?? [];
    arr.push(l);
    m.set(l.completion_date, arr);
  }
  return m;
}

export function computeStreak(
  habits: Habit[],
  logs: HabitLog[],
  endDate: Date = new Date()
): number {
  // Days where at least one scheduled habit was completed.
  const byDate = logsByDate(logs);
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = addDays(endDate, -i);
    const iso = toISODate(d);
    const scheduled = habitsDueToday(habits, d);
    if (!scheduled.length) continue;
    const dayLogs = byDate.get(iso) ?? [];
    const completedCount = dayLogs.filter((l) => l.status === "completed").length;
    if (completedCount >= 1) streak++;
    else break;
  }
  return streak;
}

export function completionRate(
  habits: Habit[],
  logs: HabitLog[],
  days: number
): number {
  let scheduled = 0;
  let completed = 0;
  const end = new Date();
  for (let i = 0; i < days; i++) {
    const d = addDays(end, -i);
    const iso = toISODate(d);
    const dueIds = new Set(habitsDueToday(habits, d).map((h) => h.id));
    scheduled += dueIds.size;
    completed += logs.filter(
      (l) => l.completion_date === iso && l.status === "completed" && dueIds.has(l.habit_id)
    ).length;
  }
  return scheduled === 0 ? 0 : completed / scheduled;
}

export function buildWeeklySummary(
  habits: Habit[],
  logs: HabitLog[],
  weekStart: Date = mondayOf()
): WeeklySummary {
  const weekDays: string[] = [];
  for (let i = 0; i < 7; i++) weekDays.push(toISODate(addDays(weekStart, i)));

  const inWeek = logs.filter((l) => weekDays.includes(l.completion_date));
  let totalScheduled = 0;
  let totalCompleted = 0;
  let totalSkipped = 0;

  for (const day of weekDays) {
    const d = new Date(day + "T12:00:00");
    const due = habitsDueToday(habits, d);
    totalScheduled += due.length;
    const dayLogs = inWeek.filter((l) => l.completion_date === day);
    totalCompleted += dayLogs.filter((l) => l.status === "completed").length;
    totalSkipped += dayLogs.filter((l) => l.status === "skipped").length;
  }

  const per_habit = habits.map((h) => {
    const c = inWeek.filter((l) => l.habit_id === h.id && l.status === "completed").length;
    const s = inWeek.filter((l) => l.habit_id === h.id && l.status === "skipped").length;
    return {
      habit_id: h.id,
      title: h.title,
      completed: c,
      skipped: s,
      rate: c + s === 0 ? 0 : c / (c + s),
    };
  });

  const most_skipped = per_habit
    .filter((p) => p.skipped > 0)
    .sort((a, b) => b.skipped - a.skipped)
    .slice(0, 3)
    .map((p) => ({ habit_id: p.habit_id, title: p.title, count: p.skipped }));

  const windowBuckets = new Map<TimeOfDay, { done: number; total: number }>();
  for (const l of inWeek) {
    const h = habits.find((h) => h.id === l.habit_id);
    if (!h) continue;
    const b = windowBuckets.get(h.preferred_time) ?? { done: 0, total: 0 };
    b.total++;
    if (l.status === "completed") b.done++;
    windowBuckets.set(h.preferred_time, b);
  }
  const best_windows = [...windowBuckets.entries()]
    .map(([window, v]) => ({ window, completion_rate: v.total ? v.done / v.total : 0 }))
    .sort((a, b) => b.completion_rate - a.completion_rate)
    .slice(0, 3);

  const moods = inWeek.map((l) => l.mood).filter((m): m is number => typeof m === "number");
  const mood_avg = moods.length ? moods.reduce((s, m) => s + m, 0) / moods.length : null;

  const mood_trend = weekDays.map((day) => {
    const ms = inWeek.filter((l) => l.completion_date === day && l.mood != null);
    const avg = ms.length ? ms.reduce((s, l) => s + (l.mood ?? 0), 0) / ms.length : 0;
    return { date: day, mood: Number(avg.toFixed(2)) };
  });

  const blockerCounts = new Map<string, number>();
  for (const l of inWeek) {
    if (!l.blocker_note) continue;
    const key = l.blocker_note.trim().toLowerCase();
    blockerCounts.set(key, (blockerCounts.get(key) ?? 0) + 1);
  }
  const top_blockers = [...blockerCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k]) => k);

  const streak_days = weekDays.filter((day) =>
    inWeek.some((l) => l.completion_date === day && l.status === "completed")
  ).length;

  return {
    completion_rate: totalScheduled === 0 ? 0 : totalCompleted / totalScheduled,
    total_scheduled: totalScheduled,
    total_completed: totalCompleted,
    total_skipped: totalSkipped,
    streak_days,
    most_skipped,
    best_windows,
    mood_avg,
    mood_trend,
    top_blockers,
    per_habit,
  };
}
