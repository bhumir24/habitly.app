// Pure helpers around habit/log collections. DB-agnostic.
import type { Habit, HabitLog, TimeOfDay, WeeklySummary } from "@/types";
import {
  calendarDateInTimeZone,
  dayOfWeekForCalendarDate,
  isHabitScheduledForCalendarDay,
  mondayOfCalendarWeekContaining,
  nextCalendarDay,
  prevCalendarDay,
} from "@/lib/date";

export function habitsDueToday(habits: Habit[], timeZone: string) {
  const iso = calendarDateInTimeZone(timeZone);
  return habits.filter(
    (h) =>
      h.is_active &&
      isHabitScheduledForCalendarDay(h.frequency, h.custom_days, iso, timeZone)
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
  endDate: Date = new Date(),
  timeZone = "UTC"
): number {
  const byDate = logsByDate(logs);
  let streak = 0;
  let iso = calendarDateInTimeZone(timeZone, endDate);
  for (let step = 0; step < 365; step++) {
    const scheduled = habits.filter(
      (h) =>
        h.is_active &&
        isHabitScheduledForCalendarDay(h.frequency, h.custom_days, iso, timeZone)
    );
    if (!scheduled.length) {
      iso = prevCalendarDay(iso);
      continue;
    }
    const dayLogs = byDate.get(iso) ?? [];
    const completedCount = dayLogs.filter((l) => l.status === "completed").length;
    if (completedCount >= 1) streak++;
    else break;
    iso = prevCalendarDay(iso);
  }
  return streak;
}

export function completionRate(
  habits: Habit[],
  logs: HabitLog[],
  days: number,
  timeZone = "UTC"
): number {
  let scheduled = 0;
  let completed = 0;
  let iso = calendarDateInTimeZone(timeZone);
  for (let i = 0; i < days; i++) {
    const dueIds = new Set(
      habits
        .filter(
          (h) =>
            h.is_active &&
            isHabitScheduledForCalendarDay(h.frequency, h.custom_days, iso, timeZone)
        )
        .map((h) => h.id)
    );
    scheduled += dueIds.size;
    completed += logs.filter(
      (l) =>
        l.completion_date === iso &&
        l.status === "completed" &&
        dueIds.has(l.habit_id)
    ).length;
    iso = prevCalendarDay(iso);
  }
  return scheduled === 0 ? 0 : completed / scheduled;
}

export function buildWeeklySummary(
  habits: Habit[],
  logs: HabitLog[],
  timeZone: string,
  options?: {
    weekMondayISO?: string;
    dailyMoods?: Array<{ mood_date: string; mood: number }>;
  }
): WeeklySummary {
  const tz = timeZone?.trim() || "UTC";
  const mondayStr =
    options?.weekMondayISO ??
    mondayOfCalendarWeekContaining(calendarDateInTimeZone(tz), tz);

  const weekDays: string[] = [];
  let d = mondayStr;
  for (let i = 0; i < 7; i++) {
    weekDays.push(d);
    d = nextCalendarDay(d);
  }

  const inWeek = logs.filter((l) => weekDays.includes(l.completion_date));
  let totalScheduled = 0;
  let totalCompleted = 0;
  let totalSkipped = 0;
  let weekdayScheduled = 0;
  let weekdayCompleted = 0;
  let weekendScheduled = 0;
  let weekendCompleted = 0;

  for (const day of weekDays) {
    const dow = dayOfWeekForCalendarDate(day, tz);
    const isWeekend = dow === 0 || dow === 6;
    const due = habits.filter(
      (h) =>
        h.is_active &&
        isHabitScheduledForCalendarDay(h.frequency, h.custom_days, day, tz)
    );
    const dayLogs = inWeek.filter((l) => l.completion_date === day);
    const completedCount = dayLogs.filter((l) => l.status === "completed").length;

    totalScheduled += due.length;
    totalCompleted += completedCount;
    totalSkipped += dayLogs.filter((l) => l.status === "skipped").length;

    if (isWeekend) {
      weekendScheduled += due.length;
      weekendCompleted += completedCount;
    } else {
      weekdayScheduled += due.length;
      weekdayCompleted += completedCount;
    }
  }

  const per_habit = habits.map((h) => {
    const c = inWeek.filter((l) => l.habit_id === h.id && l.status === "completed").length;
    const s = inWeek.filter((l) => l.habit_id === h.id && l.status === "skipped").length;
    const daysArr = weekDays.map((day) => {
      const log = inWeek.find((l) => l.habit_id === h.id && l.completion_date === day);
      const status =
        log?.status === "completed"
          ? "completed"
          : log?.status === "skipped"
          ? "skipped"
          : "none";
      return { date: day, status } as { date: string; status: "completed" | "skipped" | "none" };
    });
    // Streak: consecutive completed days from the most recent day backwards (skip unscheduled "none" days)
    let streak = 0;
    for (let i = daysArr.length - 1; i >= 0; i--) {
      if (daysArr[i].status === "completed") streak++;
      else if (daysArr[i].status === "skipped") break;
      // "none" = not scheduled that day, keep counting back
    }
    return {
      habit_id: h.id,
      title: h.title,
      category: h.category,
      completed: c,
      skipped: s,
      rate: c + s === 0 ? 0 : c / (c + s),
      streak,
      days: daysArr,
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

  // Prefer daily_moods entries; fall back to averaging mood from habit_logs
  const dailyMoodsMap = new Map(
    (options?.dailyMoods ?? []).map((m) => [m.mood_date, m.mood])
  );
  const moodSources: number[] = options?.dailyMoods?.length
    ? options.dailyMoods.filter((m) => weekDays.includes(m.mood_date)).map((m) => m.mood)
    : inWeek.map((l) => l.mood).filter((m): m is number => typeof m === "number");
  const mood_avg = moodSources.length
    ? moodSources.reduce((s, m) => s + m, 0) / moodSources.length
    : null;

  const mood_trend = weekDays.map((day) => {
    if (dailyMoodsMap.has(day)) return { date: day, mood: dailyMoodsMap.get(day)! };
    const ms = inWeek.filter((l) => l.completion_date === day && l.mood != null);
    const avg = ms.length ? ms.reduce((s, l) => s + (l.mood ?? 0), 0) / ms.length : 0;
    return { date: day, mood: Number(avg.toFixed(2)) };
  });

  const excuseKeywords = ["tired", "busy", "forgot", "didn't feel like it", "lazy", "procrastinated", "slept in", "no time", "too hard"];
  const excuseCounts = new Map<string, number>();
  const validCounts = new Map<string, number>();

  for (const l of inWeek) {
    if (!l.blocker_note) continue;
    const key = l.blocker_note.trim().toLowerCase();
    const isExcuse = excuseKeywords.some((keyword) => key.includes(keyword));
    if (isExcuse) {
      excuseCounts.set(key, (excuseCounts.get(key) ?? 0) + 1);
    } else {
      validCounts.set(key, (validCounts.get(key) ?? 0) + 1);
    }
  }

  const excuses = [...excuseCounts.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  const valid_blockers = [...validCounts.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);

  const streak_days = weekDays.filter((day) =>
    inWeek.some((l) => l.completion_date === day && l.status === "completed")
  ).length;

  return {
    completion_rate: totalScheduled === 0 ? 0 : totalCompleted / totalScheduled,
    total_scheduled: totalScheduled,
    total_completed: totalCompleted,
    total_skipped: totalSkipped,
    streak_days,
    weekday_rate: weekdayScheduled === 0 ? null : weekdayCompleted / weekdayScheduled,
    weekend_rate: weekendScheduled === 0 ? null : weekendCompleted / weekendScheduled,
    most_skipped,
    best_windows,
    mood_avg,
    mood_trend,
    valid_blockers,
    excuses,
    per_habit,
  };
}
