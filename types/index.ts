// Core domain types shared between server actions, AI layer, and UI.
// Keep these pure (no framework imports) so they're reusable in a future RN app.

export type LifeMode =
  | "student"
  | "working_pro"
  | "parent"
  | "athlete"
  | "recovery"
  | "flexible";

export type EnergyLevel = "low" | "medium" | "high" | "variable";

export type HabitCategory =
  | "health"
  | "mind"
  | "productivity"
  | "learning"
  | "social"
  | "sleep"
  | "nutrition"
  | "movement"
  | "other";

export type HabitFrequency =
  | "daily"
  | "weekdays"
  | "weekends"
  | "custom"
  | "3x_week"
  | "5x_week";

export type TimeOfDay =
  | "early_morning"
  | "morning"
  | "midday"
  | "afternoon"
  | "evening"
  | "night"
  | "any";

export type Difficulty = "micro" | "easy" | "medium" | "hard";

export type HabitLogStatus = "completed" | "skipped" | "modified";

export type PlanTier = "free" | "premium";

export type CoachRole = "user" | "assistant" | "system";

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  timezone: string;
  energy_baseline: EnergyLevel;
  life_mode: LifeMode;
  onboarded_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OnboardingResponse {
  id: string;
  user_id: string;
  goals: string[];
  availability_min: number;
  routine: {
    wake?: string;
    sleep?: string;
    work_block?: string;
    [k: string]: unknown;
  };
  energy_level: EnergyLevel;
  life_mode: LifeMode;
  blockers: string[];
  preferred_times: TimeOfDay[];
  notes: string | null;
  created_at: string;
}

export interface Habit {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  purpose: string | null;
  category: HabitCategory;
  frequency: HabitFrequency;
  custom_days: number[] | null;
  preferred_time: TimeOfDay;
  scheduled_at: string | null;
  duration_minutes: number;
  difficulty: Difficulty;
  fallback_habit: string | null;
  is_active: boolean;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface HabitLog {
  id: string;
  habit_id: string;
  user_id: string;
  status: HabitLogStatus;
  completion_date: string; // YYYY-MM-DD
  mood: number | null;
  blocker_note: string | null;
  created_at: string;
}

export interface Reminder {
  id: string;
  user_id: string;
  habit_id: string;
  remind_at: string; // HH:MM
  channel: "in_app" | "email" | "push";
  enabled: boolean;
  last_sent_at: string | null;
  created_at: string;
}

export interface CoachMessage {
  id: string;
  user_id: string;
  role: CoachRole;
  content: string;
  context: Record<string, unknown>;
  created_at: string;
}

export interface WeeklyReport {
  id: string;
  user_id: string;
  week_start: string;
  summary_json: WeeklySummary;
  ai_insight: string | null;
  recommended_next_step: string | null;
  created_at: string;
}

export interface WeeklySummary {
  completion_rate: number;
  total_scheduled: number;
  total_completed: number;
  total_skipped: number;
  streak_days: number;
  most_skipped: Array<{ habit_id: string; title: string; count: number }>;
  best_windows: Array<{ window: TimeOfDay; completion_rate: number }>;
  mood_avg: number | null;
  mood_trend: Array<{ date: string; mood: number }>;
  top_blockers: string[];
  per_habit: Array<{
    habit_id: string;
    title: string;
    completed: number;
    skipped: number;
    rate: number;
  }>;
}

export interface Subscription {
  id: string;
  user_id: string;
  tier: PlanTier;
  started_at: string;
  renews_at: string | null;
  provider: string | null;
  provider_id: string | null;
}

// ------ AI shapes -------------------------------------------------

export interface GeneratedHabit {
  title: string;
  purpose: string;
  category: HabitCategory;
  frequency: HabitFrequency;
  preferred_time: TimeOfDay;
  duration_minutes: number;
  difficulty: Difficulty;
  fallback_habit: string;
}

export interface GeneratedPlan {
  rationale: string;
  habits: GeneratedHabit[];
}

export type AdaptationKind =
  | "simpler_version"
  | "alternate_time"
  | "reduced_frequency"
  | "recovery_day"
  | "micro_substitute"
  | "progression";

export interface Adaptation {
  habit_id: string;
  kind: AdaptationKind;
  reason: string;
  suggestion: string;
  patch: Partial<
    Pick<
      Habit,
      | "difficulty"
      | "frequency"
      | "preferred_time"
      | "duration_minutes"
      | "title"
    >
  >;
}
