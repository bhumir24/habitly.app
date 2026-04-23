import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const onboardingTable = pgTable("onboarding", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  goals: text("goals").array().notNull(),
  dailyMinutes: integer("daily_minutes").notNull(),
  wakeTime: text("wake_time").notNull(),
  sleepTime: text("sleep_time").notNull(),
  workBlock: text("work_block").notNull(),
  energyLevel: text("energy_level").notNull(),
  lifeMode: text("life_mode").notNull(),
  blockers: text("blockers").array().notNull(),
  notes: text("notes"),
  completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertOnboardingSchema = createInsertSchema(onboardingTable).omit({ id: true });
export type InsertOnboarding = z.infer<typeof insertOnboardingSchema>;
export type Onboarding = typeof onboardingTable.$inferSelect;
