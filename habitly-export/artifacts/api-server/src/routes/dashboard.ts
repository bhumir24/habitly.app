import { Router } from "express";
import { db, habitsTable, habitLogsTable, remindersTable } from "@workspace/db";
import { eq, and, gte, desc } from "drizzle-orm";
import { ApplyAdaptationBody, ApplyAdaptationParams } from "@workspace/api-zod";
import { requireAuth, type AuthRequest } from "../lib/auth";

const router = Router();

router.get("/dashboard/summary", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const today = new Date().toISOString().slice(0, 10);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().slice(0, 10);

  const [habits, todayLogs, weekLogs, reminders] = await Promise.all([
    db.select().from(habitsTable).where(and(eq(habitsTable.userId, user.id), eq(habitsTable.isActive, true))),
    db.select().from(habitLogsTable).where(and(eq(habitLogsTable.userId, user.id), eq(habitLogsTable.date, today))),
    db.select().from(habitLogsTable).where(and(eq(habitLogsTable.userId, user.id), gte(habitLogsTable.date, sevenDaysAgoStr))),
    db.select().from(remindersTable).where(and(eq(remindersTable.userId, user.id), eq(remindersTable.enabled, true))),
  ]);

  const todayTotal = habits.length;
  const todayCompleted = todayLogs.filter(l => l.status === "completed").length;

  const weekCompleted = weekLogs.filter(l => l.status === "completed").length;
  const weekTotal = weekLogs.length;
  const weekCompletionRate = weekTotal > 0 ? weekCompleted / weekTotal : 0;

  const maxStreak = habits.length > 0 ? Math.max(...habits.map(h => h.currentStreak)) : 0;
  const longestStreak = habits.length > 0 ? Math.max(...habits.map(h => h.currentStreak)) : 0;

  const habitStatusMap: Record<number, string> = {};
  todayLogs.forEach(l => { habitStatusMap[l.habitId] = l.status; });

  const todayHabits = habits.map(h => ({
    id: h.id,
    title: h.title,
    purpose: h.purpose,
    frequency: h.frequency,
    durationMinutes: h.durationMinutes,
    bestTimeOfDay: h.bestTimeOfDay,
    difficulty: h.difficulty,
    fallbackMicroHabit: h.fallbackMicroHabit,
    isActive: h.isActive,
    currentStreak: h.currentStreak,
    completionRate: h.completionRate ?? null,
    todayStatus: habitStatusMap[h.id] ?? null,
  }));

  res.json({
    todayCompleted,
    todayTotal,
    currentStreak: maxStreak,
    longestStreak,
    weekCompletionRate,
    activeHabits: habits.length,
    remindersEnabled: reminders.length,
    todayHabits,
  });
});

router.get("/dashboard/adaptations", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().slice(0, 10);

  const [habits, logs] = await Promise.all([
    db.select().from(habitsTable).where(and(eq(habitsTable.userId, user.id), eq(habitsTable.isActive, true))),
    db.select().from(habitLogsTable).where(and(eq(habitLogsTable.userId, user.id), gte(habitLogsTable.date, sevenDaysAgoStr))),
  ]);

  const adaptations: Array<{
    habitId: number;
    habitTitle: string;
    type: string;
    reason: string;
    suggestion: string;
    changes: Record<string, unknown>;
  }> = [];

  for (const habit of habits) {
    const habitLogs = logs.filter(l => l.habitId === habit.id);
    const skipped = habitLogs.filter(l => l.status === "skipped").length;
    const completed = habitLogs.filter(l => l.status === "completed").length;
    const total = habitLogs.length;
    const skipRate = total > 0 ? skipped / total : 0;

    const moodLogs = habitLogs.filter(l => l.mood !== null);
    const avgMood = moodLogs.length > 0 ? moodLogs.reduce((s, l) => s + (l.mood ?? 0), 0) / moodLogs.length : null;

    if (skipped >= 4 && skipRate > 0.6) {
      if (habit.difficulty === "hard") {
        adaptations.push({
          habitId: habit.id,
          habitTitle: habit.title,
          type: "simplify",
          reason: `You've skipped "${habit.title}" ${skipped} times this week. The difficulty might be too high.`,
          suggestion: `Reduce "${habit.title}" to easy difficulty and shorter duration`,
          changes: { difficulty: "easy", durationMinutes: Math.max(5, Math.floor(habit.durationMinutes / 2)) },
        });
      } else if (habit.frequency === "daily") {
        adaptations.push({
          habitId: habit.id,
          habitTitle: habit.title,
          type: "reduce_frequency",
          reason: `Daily "${habit.title}" is getting skipped often. A lower frequency may help build the habit first.`,
          suggestion: `Switch "${habit.title}" to weekdays only`,
          changes: { frequency: "weekdays" },
        });
      }
    } else if (habit.bestTimeOfDay !== "evening" && skipped >= 3 && completed >= 1) {
      adaptations.push({
        habitId: habit.id,
        habitTitle: habit.title,
        type: "alternate_time",
        reason: `You seem to be struggling with the morning time for "${habit.title}". Evening might suit you better.`,
        suggestion: `Move "${habit.title}" to evening`,
        changes: { bestTimeOfDay: "evening" },
      });
    } else if (completed >= 6 && skipRate < 0.2 && habit.difficulty !== "hard") {
      const nextDifficulty = habit.difficulty === "easy" ? "medium" : "hard";
      adaptations.push({
        habitId: habit.id,
        habitTitle: habit.title,
        type: "progress",
        reason: `Excellent consistency with "${habit.title}" — ${completed} completions this week!`,
        suggestion: `Increase "${habit.title}" difficulty to ${nextDifficulty}`,
        changes: { difficulty: nextDifficulty, durationMinutes: Math.min(60, habit.durationMinutes + 5) },
      });
    }

    if (avgMood !== null && avgMood < 2.5 && habitLogs.filter(l => l.blockerNote).length >= 2) {
      adaptations.push({
        habitId: habit.id,
        habitTitle: habit.title,
        type: "recovery_day",
        reason: `Low mood scores (avg ${avgMood.toFixed(1)}/5) logged during "${habit.title}". Consider a lighter version.`,
        suggestion: `Switch to the micro fallback for "${habit.title}" this week: "${habit.fallbackMicroHabit}"`,
        changes: { durationMinutes: 2 },
      });
    }
  }

  res.json(adaptations.slice(0, 5));
});

router.post("/dashboard/adaptations/:habitId/apply", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const params = ApplyAdaptationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = ApplyAdaptationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [habit] = await db
    .update(habitsTable)
    .set(parsed.data.changes as Record<string, unknown>)
    .where(and(eq(habitsTable.id, params.data.habitId), eq(habitsTable.userId, user.id)))
    .returning();

  if (!habit) {
    res.status(404).json({ error: "Habit not found" });
    return;
  }

  res.json({
    id: habit.id,
    userId: habit.userId,
    title: habit.title,
    purpose: habit.purpose,
    frequency: habit.frequency,
    durationMinutes: habit.durationMinutes,
    bestTimeOfDay: habit.bestTimeOfDay,
    difficulty: habit.difficulty,
    fallbackMicroHabit: habit.fallbackMicroHabit,
    isActive: habit.isActive,
    currentStreak: habit.currentStreak,
    completionRate: habit.completionRate ?? null,
    createdAt: habit.createdAt.toISOString(),
    updatedAt: habit.updatedAt.toISOString(),
  });
});

export default router;
