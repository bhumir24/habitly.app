// Pure domain service that analyses habits + logs and yields suggested adaptations.
// No network, no DB. Easy to unit-test and reuse in mobile.

import type { Adaptation, Habit, HabitLog, OnboardingResponse } from "@/types";

export function analyseCompletion(
  habits: Habit[],
  logs: HabitLog[]
): Map<string, { done: number; skipped: number; rate: number }> {
  const out = new Map<string, { done: number; skipped: number; rate: number }>();
  for (const h of habits) out.set(h.id, { done: 0, skipped: 0, rate: 0 });
  for (const l of logs) {
    const r = out.get(l.habit_id);
    if (!r) continue;
    if (l.status === "completed") r.done++;
    if (l.status === "skipped") r.skipped++;
  }
  for (const r of out.values()) {
    const t = r.done + r.skipped;
    r.rate = t === 0 ? 0 : r.done / t;
  }
  return out;
}

export function deriveAdaptations(
  habits: Habit[],
  logs: HabitLog[],
  onboarding: OnboardingResponse | null
): Adaptation[] {
  const stats = analyseCompletion(habits, logs);
  const adaptations: Adaptation[] = [];

  const heavyBlockers =
    onboarding?.blockers.some((b) => /energy|sleep|tired/i.test(b)) ?? false;

  for (const h of habits) {
    const s = stats.get(h.id)!;
    const n = s.done + s.skipped;
    if (n < 3) continue; // not enough signal

    if (s.rate < 0.3) {
      adaptations.push({
        habit_id: h.id,
        kind: "micro_substitute",
        reason: `Only ${Math.round(s.rate * 100)}% over ${n} attempts — this habit is too heavy right now.`,
        suggestion: `Replace with the micro version for a week: ${h.fallback_habit ?? "2-minute version"}.`,
        patch: {
          difficulty: "micro",
          duration_minutes: Math.max(2, Math.round(h.duration_minutes / 3)),
        },
      });
      continue;
    }

    if (s.rate < 0.5 && h.frequency === "daily") {
      adaptations.push({
        habit_id: h.id,
        kind: "reduced_frequency",
        reason: "Daily cadence is too much — protect the win rate.",
        suggestion: `Drop "${h.title}" to 3×/week.`,
        patch: { frequency: "3x_week" },
      });
      continue;
    }

    if (s.rate < 0.6 && h.preferred_time !== "morning" && heavyBlockers) {
      adaptations.push({
        habit_id: h.id,
        kind: "alternate_time",
        reason: "Evening skips correlate with low-energy blockers.",
        suggestion: `Move "${h.title}" to the morning window.`,
        patch: { preferred_time: "morning" },
      });
      continue;
    }

    if (s.rate >= 0.85 && h.difficulty !== "hard") {
      const next =
        h.difficulty === "micro" ? "easy" : h.difficulty === "easy" ? "medium" : "hard";
      adaptations.push({
        habit_id: h.id,
        kind: "progression",
        reason: `${Math.round(s.rate * 100)}% completion — ready to progress.`,
        suggestion: `Level up "${h.title}" to ${next}, +${Math.round(h.duration_minutes * 0.3)} min.`,
        patch: {
          difficulty: next,
          duration_minutes: Math.round(h.duration_minutes * 1.3),
        },
      });
    }
  }

  // Overwhelm detector — if 3+ habits are all <60%, suggest a recovery day.
  const strugglingCount = [...stats.values()].filter((s) => s.rate < 0.6 && s.done + s.skipped >= 3).length;
  if (strugglingCount >= 3 && habits[0]) {
    adaptations.push({
      habit_id: habits[0].id,
      kind: "recovery_day",
      reason: `${strugglingCount} habits are under 60% — this is overload.`,
      suggestion: "Take a recovery day: complete only micro fallbacks for 24 hours.",
      patch: {},
    });
  }

  return adaptations;
}
