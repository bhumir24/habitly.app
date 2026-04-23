import { Router } from "express";
import { db, remindersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { CreateReminderBody, UpdateReminderBody, UpdateReminderParams, DeleteReminderParams } from "@workspace/api-zod";
import { requireAuth, type AuthRequest } from "../lib/auth";

const router = Router();

function formatReminder(r: typeof remindersTable.$inferSelect) {
  return {
    id: r.id,
    userId: r.userId,
    habitId: r.habitId ?? null,
    label: r.label,
    time: r.time,
    enabled: r.enabled,
    createdAt: r.createdAt.toISOString(),
  };
}

router.get("/reminders", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const reminders = await db.select().from(remindersTable).where(eq(remindersTable.userId, user.id));
  res.json(reminders.map(formatReminder));
});

router.post("/reminders", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const parsed = CreateReminderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [reminder] = await db.insert(remindersTable).values({ ...parsed.data, userId: user.id }).returning();
  res.status(201).json(formatReminder(reminder));
});

router.patch("/reminders/:id", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const params = UpdateReminderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateReminderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [reminder] = await db
    .update(remindersTable)
    .set(parsed.data)
    .where(and(eq(remindersTable.id, params.data.id), eq(remindersTable.userId, user.id)))
    .returning();

  if (!reminder) {
    res.status(404).json({ error: "Reminder not found" });
    return;
  }

  res.json(formatReminder(reminder));
});

router.delete("/reminders/:id", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const params = DeleteReminderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(remindersTable)
    .where(and(eq(remindersTable.id, params.data.id), eq(remindersTable.userId, user.id)))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Reminder not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
