import { z } from "zod";

export const signUpSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(8, "At least 8 characters"),
    full_name: z.string().min(1, "Required"),
  });

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const lifeModeEnum = z.enum([
  "student",
  "working_pro",
  "parent",
  "athlete",
  "recovery",
  "flexible",
]);

export const energyEnum = z.enum(["low", "medium", "high", "variable"]);

export const timeOfDayEnum = z.enum([
  "early_morning",
  "morning",
  "midday",
  "afternoon",
  "evening",
  "night",
  "any",
]);

export const frequencyEnum = z.enum([
  "daily",
  "weekdays",
  "weekends",
  "custom",
  "3x_week",
  "5x_week",
]);

export const difficultyEnum = z.enum(["micro", "easy", "medium", "hard"]);

export const categoryEnum = z.enum([
  "health",
  "mind",
  "productivity",
  "learning",
  "social",
  "sleep",
  "nutrition",
  "movement",
  "other",
]);

export const onboardingSchema = z.object({
  goals: z.array(z.string().min(1)).min(1, "Pick at least one goal").max(10),
  availability_min: z.number().int().min(5).max(240),
  routine: z.object({
    wake: z.string().optional(),
    sleep: z.string().optional(),
    work_block: z.string().optional(),
    life_modes: z.array(lifeModeEnum).min(1).max(6).optional(),
  }),
  energy_level: energyEnum,
  life_mode: lifeModeEnum,
  blockers: z.array(z.string()).default([]),
  preferred_times: z.array(timeOfDayEnum).default([]),
  notes: z.string().max(500).optional().nullable(),
});

export const habitSchema = z.object({
  title: z.string().min(2).max(80),
  purpose: z.string().max(280).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  category: categoryEnum,
  frequency: frequencyEnum,
  custom_days: z.array(z.number().int().min(0).max(6)).optional().nullable(),
  preferred_time: timeOfDayEnum,
  duration_minutes: z.number().int().min(1).max(240),
  difficulty: difficultyEnum,
  fallback_habit: z.string().max(140).optional().nullable(),
});

export const habitLogSchema = z.object({
  habit_id: z.string().uuid(),
  status: z.enum(["completed", "skipped", "modified"]),
  completion_date: z.string().optional(),
  mood: z.number().int().min(1).max(5).optional().nullable(),
  blocker_note: z.string().max(280).optional().nullable(),
});

export const coachMessageSchema = z.object({
  content: z.string().min(1).max(1000),
  mood: z.number().int().min(1).max(5).optional(),
  blocker: z.string().max(280).optional(),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type OnboardingInput = z.infer<typeof onboardingSchema>;
export type HabitInput = z.infer<typeof habitSchema>;
export type HabitLogInput = z.infer<typeof habitLogSchema>;
export type CoachMessageInput = z.infer<typeof coachMessageSchema>;
