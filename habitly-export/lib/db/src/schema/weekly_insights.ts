import { pgTable, text, serial, integer, real, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const weeklyInsightsTable = pgTable("weekly_insights", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  weekStart: text("week_start").notNull(),
  totalCompleted: integer("total_completed").notNull().default(0),
  totalSkipped: integer("total_skipped").notNull().default(0),
  completionRate: real("completion_rate").notNull().default(0),
  averageMood: real("average_mood"),
  topHabit: text("top_habit"),
  aiSummary: text("ai_summary").notNull(),
  nextStep: text("next_step").notNull(),
  chartData: jsonb("chart_data").notNull().$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertWeeklyInsightSchema = createInsertSchema(weeklyInsightsTable).omit({ id: true, createdAt: true });
export type InsertWeeklyInsight = z.infer<typeof insertWeeklyInsightSchema>;
export type WeeklyInsight = typeof weeklyInsightsTable.$inferSelect;
