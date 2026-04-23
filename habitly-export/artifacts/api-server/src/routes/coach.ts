import { Router } from "express";
import { db, coachMessagesTable, habitsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { SendCoachMessageBody } from "@workspace/api-zod";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { generateCoachReply } from "../lib/ai";

const router = Router();

function formatMessage(m: typeof coachMessagesTable.$inferSelect) {
  return {
    id: m.id,
    userId: m.userId,
    role: m.role,
    content: m.content,
    mood: m.mood ?? null,
    blockerNote: m.blockerNote ?? null,
    createdAt: m.createdAt.toISOString(),
  };
}

router.get("/coach/messages", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const messages = await db
    .select()
    .from(coachMessagesTable)
    .where(eq(coachMessagesTable.userId, user.id))
    .orderBy(coachMessagesTable.createdAt)
    .limit(100);

  res.json(messages.map(formatMessage));
});

router.post("/coach/messages", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const parsed = SendCoachMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if (user.tier === "free") {
    const today = new Date().toISOString().slice(0, 10);
    const todayMessages = await db
      .select()
      .from(coachMessagesTable)
      .where(eq(coachMessagesTable.userId, user.id));

    const todayUserMessages = todayMessages.filter(m =>
      m.role === "user" && m.createdAt.toISOString().slice(0, 10) === today
    );

    if (todayUserMessages.length >= 10) {
      res.status(429).json({ error: "Daily message limit reached. Upgrade to Premium for unlimited coaching." });
      return;
    }
  }

  await db.insert(coachMessagesTable).values({
    userId: user.id,
    role: "user",
    content: parsed.data.content,
    mood: parsed.data.mood ?? null,
    blockerNote: parsed.data.blockerNote ?? null,
  });

  const habits = await db.select().from(habitsTable).where(eq(habitsTable.userId, user.id));

  const replyContent = generateCoachReply(
    parsed.data.content,
    parsed.data.mood,
    parsed.data.blockerNote,
    habits.map(h => ({ title: h.title, currentStreak: h.currentStreak, completionRate: h.completionRate ?? null, isActive: h.isActive })),
  );

  const [reply] = await db.insert(coachMessagesTable).values({
    userId: user.id,
    role: "assistant",
    content: replyContent,
  }).returning();

  res.status(201).json(formatMessage(reply));
});

export default router;
