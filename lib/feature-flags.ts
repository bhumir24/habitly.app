import type { PlanTier } from "@/types";

// Centralised definition of what each tier can do.
// UI + server actions read from this — never hardcode tier strings.

export const PREMIUM_FEATURES = {
  advanced_coach: "advanced_coach",
  deep_adaptation: "deep_adaptation",
  detailed_reports: "detailed_reports",
  advanced_reminders: "advanced_reminders",
  unlimited_habits: "unlimited_habits",
} as const;

export type FeatureKey = keyof typeof PREMIUM_FEATURES;

export const FREE_LIMITS = {
  max_active_habits: 5,
  coach_messages_per_day: 10,
};

export function canUse(tier: PlanTier, feature: FeatureKey): boolean {
  if (process.env.NEXT_PUBLIC_FORCE_PREMIUM === "true") return true;
  if (tier === "premium") return true;
  // Free tier gets nothing from the PREMIUM_FEATURES list.
  return false;
}

export function featureCopy(feature: FeatureKey): {
  title: string;
  description: string;
} {
  switch (feature) {
    case "advanced_coach":
      return {
        title: "Advanced AI Coach",
        description:
          "Longer memory, mood-aware replies, and proactive nudges on low-energy days.",
      };
    case "deep_adaptation":
      return {
        title: "Deep Adaptive Planning",
        description:
          "Full re-plan on sustained slumps, recovery weeks, and progression ladders.",
      };
    case "detailed_reports":
      return {
        title: "Detailed Weekly Reports",
        description:
          "Per-habit breakdowns, mood trends, and best-window analytics.",
      };
    case "advanced_reminders":
      return {
        title: "Smart Reminders",
        description:
          "Context-aware reminder times based on your completion history.",
      };
    case "unlimited_habits":
      return {
        title: "Unlimited Habits",
        description: "Go beyond the free cap of 5 active habits.",
      };
  }
}
