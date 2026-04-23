import { Router } from "express";
import { db, weeklyInsightsTable, habitLogsTable, habitsTable } from "@workspace/db";
import { eq, and, desc, gte } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { generateWeeklyInsight } from "../lib/ai";

const router = Router();

function formatInsight(i: typeof weeklyInsightsTable.$inferSelect) {
  return {
    id: i.id,
    userId: i.userId,
    weekStart: i.weekStart,
    totalCompleted: i.totalCompleted,
    totalSkipped: i.totalSkipped,
    completionRate: i.completionRate,
    averageMood: i.averageMood ?? null,
    topHabit: i.topHabit ?? null,
    aiSummary: i.aiSummary,
    nextStep: i.nextStep,
    chartData: i.chartData,
    createdAt: i.createdAt.toISOString(),
  };
}

function getWeekStart(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().slice(0, 10);
}

function getLast7Days(): string[] {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

router.get("/insights", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const insights = await db
    .select()
    .from(weeklyInsightsTable)
    .where(eq(weeklyInsightsTable.userId, user.id))
    .orderBy(desc(weeklyInsightsTable.createdAt));

  res.json(insights.map(formatInsight));
});

router.get("/insights/latest", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const insight = await db
    .select()
    .from(weeklyInsightsTable)
    .where(eq(weeklyInsightsTable.userId, user.id))
    .orderBy(desc(weeklyInsightsTable.createdAt))
    .limit(1)
    .then(r => r[0] ?? null);

  if (!insight) {
    res.status(404).json({ error: "No insights yet" });
    return;
  }

  res.json(formatInsight(insight));
});

router.post("/insights", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const weekStart = getWeekStart();
  const last7Days = getLast7Days();

  const sevenDaysAgo = last7Days[0];
  const logs = await db
    .select()
    .from(habitLogsTable)
    .where(and(
      eq(habitLogsTable.userId, user.id),
      gte(habitLogsTable.date, sevenDaysAgo)
    ));

  const habits = await db.select().from(habitsTable).where(eq(habitsTable.userId, user.id));

  const totalCompleted = logs.filter(l => l.status === "completed").length;
  const totalSkipped = logs.filter(l => l.status === "skipped").length;
  const totalLogs = logs.length;
  const completionRate = totalLogs > 0 ? totalCompleted / totalLogs : 0;

  const moodLogs = logs.filter(l => l.mood !== null);
  const averageMood = moodLogs.length > 0
    ? moodLogs.reduce((sum, l) => sum + (l.mood ?? 0), 0) / moodLogs.length
    : null;

  const habitCompletions: Record<number, number> = {};
  logs.filter(l => l.status === "completed").forEach(l => {
    habitCompletions[l.habitId] = (habitCompletions[l.habitId] ?? 0) + 1;
  });

  const topHabitId = Object.entries(habitCompletions).sort((a, b) => b[1] - a[1])[0]?.[0];
  const topHabit = topHabitId ? habits.find(h => h.id === parseInt(topHabitId, 10))?.title ?? null : null;

  const dailyCompletions: Record<string, number> = {};
  const dailySkips: Record<string, number> = {};
  const dailyMoods: Record<string, number[]> = {};

  last7Days.forEach(day => {
    dailyCompletions[day] = 0;
    dailySkips[day] = 0;
    dailyMoods[day] = [];
  });

  logs.forEach(l => {
    if (l.status === "completed") dailyCompletions[l.date] = (dailyCompletions[l.date] ?? 0) + 1;
    if (l.status === "skipped") dailySkips[l.date] = (dailySkips[l.date] ?? 0) + 1;
    if (l.mood !== null) {
      if (!dailyMoods[l.date]) dailyMoods[l.date] = [];
      dailyMoods[l.date].push(l.mood);
    }
  });

  const chartData = {
    daily: last7Days.map(day => ({
      date: day,
      completed: dailyCompletions[day] ?? 0,
      skipped: dailySkips[day] ?? 0,
      mood: dailyMoods[day]?.length > 0
        ? dailyMoods[day].reduce((a, b) => a + b, 0) / dailyMoods[day].length
        : null,
    })),
  };

  const { summary, nextStep } = generateWeeklyInsight(
    totalCompleted,
    totalSkipped,
    totalLogs,
    averageMood,
    topHabit,
    habits.length,
  );

  const [insight] = await db.insert(weeklyInsightsTable).values({
    userId: user.id,
    weekStart,
    totalCompleted,
    totalSkipped,
    completionRate,
    averageMood,
    topHabit,
    aiSummary: summary,
    nextStep,
    chartData,
  }).returning();

  res.status(201).json(formatInsight(insight));
});

export default router;
