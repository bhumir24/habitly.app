import { pgTable, text, serial, integer, boolean, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const habitsTable = pgTable("habits", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  title: text("title").notNull(),
  purpose: text("purpose").notNull(),
  frequency: text("frequency").notNull().default("daily"),
  durationMinutes: integer("duration_minutes").notNull().default(10),
  bestTimeOfDay: text("best_time_of_day").notNull().default("morning"),
  difficulty: text("difficulty").notNull().default("medium"),
  fallbackMicroHabit: text("fallback_micro_habit").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  currentStreak: integer("current_streak").notNull().default(0),
  completionRate: real("completion_rate"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertHabitSchema = createInsertSchema(habitsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertHabit = z.infer<typeof insertHabitSchema>;
export type Habit = typeof habitsTable.$inferSelect;
