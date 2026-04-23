import type {
  Difficulty,
  HabitCategory,
  HabitFrequency,
  LifeMode,
  TimeOfDay,
} from "@/types";

export const LIFE_MODES: { value: LifeMode; label: string; hint: string }[] = [
  { value: "student", label: "Student", hint: "Classes, study blocks, exams" },
  { value: "working_pro", label: "Working Professional", hint: "9–6 or shift work" },
  { value: "parent", label: "Parent", hint: "Kids + limited solo time" },
  { value: "athlete", label: "Athlete / Training", hint: "Training cycles" },
  { value: "recovery", label: "Recovery / Rebuild", hint: "Coming back from a slump" },
  { value: "flexible", label: "Flexible", hint: "No fixed schedule" },
];

export const ENERGY_LEVELS = [
  { value: "low", label: "Low", hint: "Tired often, short focus" },
  { value: "medium", label: "Medium", hint: "Decent most days" },
  { value: "high", label: "High", hint: "Consistently energetic" },
  { value: "variable", label: "Variable", hint: "Good days / bad days" },
] as const;

export const TIME_WINDOWS: { value: TimeOfDay; label: string }[] = [
  { value: "early_morning", label: "Early morning" },
  { value: "morning", label: "Morning" },
  { value: "midday", label: "Midday" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
  { value: "night", label: "Night" },
  { value: "any", label: "Any time" },
];

export const FREQUENCIES: { value: HabitFrequency; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekdays", label: "Weekdays" },
  { value: "weekends", label: "Weekends" },
  { value: "3x_week", label: "3× / week" },
  { value: "5x_week", label: "5× / week" },
  { value: "custom", label: "Custom" },
];

export const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: "micro", label: "Micro (≤2 min)" },
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
];

export const CATEGORIES: { value: HabitCategory; label: string }[] = [
  { value: "health", label: "Health" },
  { value: "mind", label: "Mind" },
  { value: "productivity", label: "Productivity" },
  { value: "learning", label: "Learning" },
  { value: "social", label: "Social" },
  { value: "sleep", label: "Sleep" },
  { value: "nutrition", label: "Nutrition" },
  { value: "movement", label: "Movement" },
  { value: "other", label: "Other" },
];

export const GOAL_SUGGESTIONS = [
  "Sleep 7+ hours consistently",
  "Exercise 3× per week",
  "Read daily",
  "Reduce screen time",
  "Build a meditation practice",
  "Eat more whole foods",
  "Stay hydrated",
  "Ship a side project",
  "Improve focus at work",
  "Journal daily",
];

export const COMMON_BLOCKERS = [
  "Low evening energy",
  "Phone distractions",
  "Inconsistent sleep",
  "Unpredictable schedule",
  "No accountability",
  "Overambitious past plans",
  "Travel / commute",
];
