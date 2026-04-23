import { Router } from "express";
import { db, onboardingTable, habitsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { SaveOnboardingBody } from "@workspace/api-zod";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { generateHabitPlan } from "../lib/ai";

const router = Router();

function formatOnboarding(o: typeof onboardingTable.$inferSelect) {
  return {
    id: o.id,
    userId: o.userId,
    goals: o.goals,
    dailyMinutes: o.dailyMinutes,
    wakeTime: o.wakeTime,
    sleepTime: o.sleepTime,
    workBlock: o.workBlock,
    energyLevel: o.energyLevel,
    lifeMode: o.lifeMode,
    blockers: o.blockers,
    notes: o.notes ?? null,
    completedAt: o.completedAt.toISOString(),
  };
}

router.get("/onboarding", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const onboarding = await db
    .select()
    .from(onboardingTable)
    .where(eq(onboardingTable.userId, user.id))
    .then(r => r[0] ?? null);

  if (!onboarding) {
    res.status(404).json({ error: "Onboarding not found" });
    return;
  }

  res.json(formatOnboarding(onboarding));
});

router.post("/onboarding", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const parsed = SaveOnboardingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  await db.delete(onboardingTable).where(eq(onboardingTable.userId, user.id));

  const [onboarding] = await db.insert(onboardingTable).values({
    userId: user.id,
    ...parsed.data,
  }).returning();

  const generatedHabits = generateHabitPlan(onboarding);

  await db.delete(habitsTable).where(eq(habitsTable.userId, user.id));

  const habits = await db.insert(habitsTable).values(
    generatedHabits.map(h => ({ ...h, userId: user.id }))
  ).returning();

  res.status(201).json({
    onboarding: formatOnboarding(onboarding),
    habits: habits.map(h => ({
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
    })),
  });
});

export default router;
