import { Router } from "express";
import { db, habitsTable, onboardingTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { CreateHabitBody, UpdateHabitBody, GetHabitParams, UpdateHabitParams, DeleteHabitParams } from "@workspace/api-zod";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { generateHabitPlan } from "../lib/ai";

const router = Router();

function formatHabit(h: typeof habitsTable.$inferSelect) {
  return {
    id: h.id,
    userId: h.userId,
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
    createdAt: h.createdAt.toISOString(),
    updatedAt: h.updatedAt.toISOString(),
  };
}

router.get("/habits", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const habits = await db.select().from(habitsTable).where(eq(habitsTable.userId, user.id));
  res.json(habits.map(formatHabit));
});

router.post("/habits", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const parsed = CreateHabitBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [habit] = await db.insert(habitsTable).values({ ...parsed.data, userId: user.id }).returning();
  res.status(201).json(formatHabit(habit));
});

router.post("/habits/generate", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const onboarding = await db
    .select()
    .from(onboardingTable)
    .where(eq(onboardingTable.userId, user.id))
    .then(r => r[0] ?? null);

  if (!onboarding) {
    res.status(400).json({ error: "Complete onboarding first" });
    return;
  }

  await db.delete(habitsTable).where(eq(habitsTable.userId, user.id));
  const generatedHabits = generateHabitPlan(onboarding);
  const habits = await db.insert(habitsTable).values(
    generatedHabits.map(h => ({ ...h, userId: user.id }))
  ).returning();

  res.json(habits.map(formatHabit));
});

router.get("/habits/:id", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const params = GetHabitParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const habit = await db
    .select()
    .from(habitsTable)
    .where(and(eq(habitsTable.id, params.data.id), eq(habitsTable.userId, user.id)))
    .then(r => r[0] ?? null);

  if (!habit) {
    res.status(404).json({ error: "Habit not found" });
    return;
  }

  res.json(formatHabit(habit));
});

router.patch("/habits/:id", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const params = UpdateHabitParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateHabitBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [habit] = await db
    .update(habitsTable)
    .set(parsed.data)
    .where(and(eq(habitsTable.id, params.data.id), eq(habitsTable.userId, user.id)))
    .returning();

  if (!habit) {
    res.status(404).json({ error: "Habit not found" });
    return;
  }

  res.json(formatHabit(habit));
});

router.delete("/habits/:id", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const params = DeleteHabitParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(habitsTable)
    .where(and(eq(habitsTable.id, params.data.id), eq(habitsTable.userId, user.id)))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Habit not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
