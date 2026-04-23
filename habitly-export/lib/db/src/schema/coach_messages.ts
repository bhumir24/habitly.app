import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const coachMessagesTable = pgTable("coach_messages", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  mood: integer("mood"),
  blockerNote: text("blocker_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCoachMessageSchema = createInsertSchema(coachMessagesTable).omit({ id: true, createdAt: true });
export type InsertCoachMessage = z.infer<typeof insertCoachMessageSchema>;
export type CoachMessage = typeof coachMessagesTable.$inferSelect;
