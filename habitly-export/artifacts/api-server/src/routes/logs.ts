import { Router } from "express";
import { db, habitLogsTable, habitsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { CreateLogBody, GetHabitLogsParams, ListLogsQueryParams } from "@workspace/api-zod";
import { requireAuth, type AuthRequest } from "../lib/auth";

const router = Router();

function formatLog(l: typeof habitLogsTable.$inferSelect) {
  return {
    id: l.id,
    habitId: l.habitId,
    userId: l.userId,
    status: l.status,
    date: l.date,
    mood: l.mood ?? null,
    blockerNote: l.blockerNote ?? null,
    createdAt: l.createdAt.toISOString(),
  };
}

router.get("/habits/:id/logs", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const params = GetHabitLogsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const logs = await db
    .select()
    .from(habitLogsTable)
    .where(and(eq(habitLogsTable.habitId, params.data.id), eq(habitLogsTable.userId, user.id)))
    .orderBy(desc(habitLogsTable.createdAt))
    .limit(30);

  res.json(logs.map(formatLog));
});

router.get("/logs", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const qp = ListLogsQueryParams.safeParse(req.query);

  const conditions = [eq(habitLogsTable.userId, user.id)];
  if (qp.success && qp.data.date) {
    conditions.push(eq(habitLogsTable.date, qp.data.date));
  }

  const logs = await db
    .select()
    .from(habitLogsTable)
    .where(and(...conditions))
    .orderBy(desc(habitLogsTable.createdAt));

  res.json(logs.map(formatLog));
});

router.post("/logs", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const parsed = CreateLogBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [log] = await db
    .insert(habitLogsTable)
    .values({ ...parsed.data, userId: user.id })
    .returning();

  if (parsed.data.status === "completed") {
    const habit = await db.select().from(habitsTable).where(eq(habitsTable.id, parsed.data.habitId)).then(r => r[0]);
    if (habit) {
      const newStreak = habit.currentStreak + 1;
      const allLogs = await db.select().from(habitLogsTable).where(eq(habitLogsTable.habitId, habit.id));
      const completedCount = allLogs.filter(l => l.status === "completed").length;
      const rate = allLogs.length > 0 ? completedCount / allLogs.length : 0;
      await db.update(habitsTable).set({ currentStreak: newStreak, completionRate: rate }).where(eq(habitsTable.id, habit.id));
    }
  } else if (parsed.data.status === "skipped") {
    const habit = await db.select().from(habitsTable).where(eq(habitsTable.id, parsed.data.habitId)).then(r => r[0]);
    if (habit && habit.currentStreak > 0) {
      await db.update(habitsTable).set({ currentStreak: 0 }).where(eq(habitsTable.id, habit.id));
    }
  }

  res.status(201).json(formatLog(log));
});

export default router;
