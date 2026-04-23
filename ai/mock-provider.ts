import type { AIProvider } from "./provider";
import type {
  Adaptation,
  GeneratedHabit,
  GeneratedPlan,
  Habit,
  HabitCategory,
  HabitFrequency,
  OnboardingResponse,
  TimeOfDay,
} from "@/types";

// Deterministic, context-aware mock AI. The goal is *not* randomness —
// it's to produce replies that clearly reference the user's inputs so
// the UX is demo-worthy without an API key.

export class MockProvider implements AIProvider {
  name = "mock";

  async generatePlan({
    onboarding: o,
  }: {
    onboarding: OnboardingResponse;
  }): Promise<GeneratedPlan> {
    const habits: GeneratedHabit[] = [];
    const budget = o.availability_min;
    let used = 0;

    const firstTime: TimeOfDay = o.preferred_times[0] ?? "morning";
    const secondTime: TimeOfDay = o.preferred_times[1] ?? "evening";

    const pushIfFits = (h: GeneratedHabit) => {
      if (used + h.duration_minutes <= budget && habits.length < 6) {
        habits.push(h);
        used += h.duration_minutes;
      }
    };

    const lowEnergy = o.energy_level === "low" || o.energy_level === "variable";

    for (const goal of o.goals.slice(0, 5)) {
      pushIfFits(habitForGoal(goal, { lowEnergy, firstTime, secondTime }));
    }

    // Always include a sleep anchor if routine mentions it or goals touch sleep.
    if (
      !habits.find((h) => h.category === "sleep") &&
      (o.routine?.sleep || /sleep|rest/i.test(o.goals.join(" ")))
    ) {
      pushIfFits({
        title: "Lights-out anchor",
        purpose: "Protect a consistent sleep window — the biggest lever for energy.",
        category: "sleep",
        frequency: "daily",
        preferred_time: "night",
        duration_minutes: 2,
        difficulty: "micro",
        fallback_habit: "Dim main lights 10 minutes earlier than usual.",
      });
    }

    // Always add a hydration micro-habit for low energy.
    if (lowEnergy && !habits.find((h) => /water|hydrate/i.test(h.title))) {
      pushIfFits({
        title: "Glass of water on wake",
        purpose: "Kickstart energy and reduce mid-morning fatigue.",
        category: "nutrition",
        frequency: "daily",
        preferred_time: "early_morning",
        duration_minutes: 1,
        difficulty: "micro",
        fallback_habit: "Half a glass is still a win.",
      });
    }

    const rationale =
      `Plan tuned for a ${o.life_mode.replace("_", " ")} with ${o.energy_level} energy and ` +
      `${o.availability_min} min/day. Prioritised your goals: ${o.goals.slice(0, 3).join(", ")}. ` +
      `Every habit has a 2-minute fallback so bad days still count.`;

    return { rationale, habits };
  }

  async coachReply(input: Parameters<AIProvider["coachReply"]>[0]): Promise<string> {
    const msg = input.userMessage.toLowerCase();
    const missed = input.recentLogs.filter((l) => l.status === "skipped").length;
    const done = input.recentLogs.filter((l) => l.status === "completed").length;
    const firstHabit = input.activeHabits[0];
    const micro = firstHabit?.fallback_habit ?? "2 minutes of movement";

    if (input.mood && input.mood <= 2) {
      return `Rough day shows up. Skip the full ${firstHabit?.title ?? "plan"} and just do: ${micro}. ` +
        `One tiny rep keeps the identity alive. We adapt tomorrow.`;
    }

    if (/no time|busy|overwhelm/.test(msg)) {
      return `On busy days, run the 2-minute version: ${micro}. ` +
        `That protects the streak without stealing time from what's urgent.`;
    }
    if (/tired|low energy|exhaust|sleep/.test(msg)) {
      return `Your energy baseline is ${input.profileContext.energy_baseline}. Today, drop difficulty on ` +
        `${firstHabit?.title ?? "your hardest habit"} and move it earlier. Want me to apply that for today?`;
    }
    if (/miss|skip|slip|broke/.test(msg) || missed >= 3) {
      return `Missed ${missed} recently — that's signal, not failure. I'd lighten ${firstHabit?.title ?? "one habit"} ` +
        `to its micro version for 3 days. Want me to draft the change?`;
    }
    if (/motivat|lazy|can['’]t/.test(msg)) {
      return `Motivation follows action. Do ${micro} in the next 5 minutes and text me back. ` +
        `That's the entire assignment.`;
    }
    if (/progress|next level|harder|grow/.test(msg) && done >= 5) {
      return `You're consistent — time to progress. I'd bump ${firstHabit?.title ?? "one habit"} by ~30% duration ` +
        `for a week. Reply "yes" to apply it.`;
    }

    return `Heard. Given ${input.activeHabits.length} active habits and your ${input.profileContext.life_mode} mode, ` +
      `the smallest useful win today is: ${micro}. Want a tweak to the plan?`;
  }

  async adapt({
    habits,
    logs,
  }: {
    habits: Habit[];
    logs: any[];
    onboarding: OnboardingResponse | null;
  }): Promise<Adaptation[]> {
    const adaptations: Adaptation[] = [];
    const byHabit = new Map<string, { done: number; skipped: number }>();
    for (const h of habits) byHabit.set(h.id, { done: 0, skipped: 0 });
    for (const l of logs) {
      const rec = byHabit.get(l.habit_id);
      if (!rec) continue;
      if (l.status === "completed") rec.done++;
      if (l.status === "skipped") rec.skipped++;
    }

    for (const h of habits) {
      const rec = byHabit.get(h.id)!;
      const total = rec.done + rec.skipped;
      if (total < 3) continue;
      const rate = rec.done / total;

      if (rate < 0.4 && h.difficulty !== "micro") {
        adaptations.push({
          habit_id: h.id,
          kind: "simpler_version",
          reason: `Only ${Math.round(rate * 100)}% completion over the last ${total} attempts.`,
          suggestion: `Reduce "${h.title}" to its micro version for 7 days: ${h.fallback_habit ?? "2-minute version"}.`,
          patch: {
            difficulty: h.difficulty === "hard" ? "easy" : "micro",
            duration_minutes: Math.max(2, Math.round(h.duration_minutes / 2)),
          },
        });
        continue;
      }
      if (rate < 0.5 && h.frequency === "daily") {
        adaptations.push({
          habit_id: h.id,
          kind: "reduced_frequency",
          reason: "Daily cadence isn't landing — consistency beats intensity.",
          suggestion: `Drop "${h.title}" to 3×/week for a cleaner win-rate.`,
          patch: { frequency: "3x_week" },
        });
        continue;
      }
      if (rate >= 0.85 && h.difficulty !== "hard") {
        adaptations.push({
          habit_id: h.id,
          kind: "progression",
          reason: `${Math.round(rate * 100)}% completion — ready for the next step.`,
          suggestion: `Progress "${h.title}" to a harder tier with +${Math.round(h.duration_minutes * 0.3)} min.`,
          patch: {
            difficulty: h.difficulty === "micro" ? "easy" : h.difficulty === "easy" ? "medium" : "hard",
            duration_minutes: Math.round(h.duration_minutes * 1.3),
          },
        });
      }
    }

    return adaptations;
  }

  async weeklyInsight({
    summary,
    onboarding,
  }: Parameters<AIProvider["weeklyInsight"]>[0]) {
    const rate = Math.round(summary.completion_rate * 100);
    const best = summary.best_windows[0];
    const worst = summary.most_skipped[0];

    let insight = `You completed ${rate}% of scheduled habits this week`;
    if (best) insight += `, strongest in the ${best.window.replace("_", " ")} window`;
    insight += `. `;
    if (worst) {
      insight += `"${worst.title}" was skipped ${worst.count}× — biggest friction point. `;
    }
    if (summary.mood_avg != null) {
      insight += `Mood averaged ${summary.mood_avg.toFixed(1)}/5. `;
    }
    if (summary.top_blockers.length) {
      insight += `Common blocker: "${summary.top_blockers[0]}".`;
    }

    let next_step = "";
    if (rate < 50 && worst) {
      next_step = `Shrink "${worst.title}" to its 2-minute fallback for 7 days. Win-rate first, volume later.`;
    } else if (rate >= 80) {
      next_step = `Pick ONE habit to progress — raise duration ~30%. Keep the rest unchanged.`;
    } else {
      next_step = `Move your weakest habit into the ${best?.window.replace("_", " ") ?? "morning"} window where your completion is highest.`;
    }
    if (onboarding?.energy_level === "low") {
      next_step += " Keep intensity capped — you're playing a long game.";
    }

    return { insight, next_step };
  }
}

// ---- helpers ----------------------------------------------------

function habitForGoal(
  goal: string,
  ctx: { lowEnergy: boolean; firstTime: TimeOfDay; secondTime: TimeOfDay }
): GeneratedHabit {
  const g = goal.toLowerCase();
  const base = (overrides: Partial<GeneratedHabit>): GeneratedHabit => ({
    title: overrides.title ?? "Daily check-in",
    purpose: overrides.purpose ?? `Support goal: ${goal}`,
    category: overrides.category ?? "other",
    frequency: overrides.frequency ?? "daily",
    preferred_time: overrides.preferred_time ?? ctx.firstTime,
    duration_minutes: overrides.duration_minutes ?? 10,
    difficulty: overrides.difficulty ?? (ctx.lowEnergy ? "easy" : "medium"),
    fallback_habit: overrides.fallback_habit ?? "Do the 2-minute version.",
  });

  if (/sleep|rest/.test(g))
    return base({
      title: "Wind-down routine",
      purpose: `Protect sleep to support: ${goal}`,
      category: "sleep",
      preferred_time: "night",
      duration_minutes: 10,
      difficulty: "easy",
      fallback_habit: "Phone out of bedroom 10 min earlier.",
    });
  if (/exercise|workout|fit|strong|gym/.test(g))
    return base({
      title: ctx.lowEnergy ? "15-min mobility + walk" : "Strength or cardio session",
      purpose: `Build consistent movement for: ${goal}`,
      category: "movement",
      frequency: "3x_week",
      preferred_time: ctx.firstTime,
      duration_minutes: ctx.lowEnergy ? 15 : 30,
      difficulty: ctx.lowEnergy ? "easy" : "medium",
      fallback_habit: "10 squats + 10 push-ups anywhere.",
    });
  if (/read/.test(g))
    return base({
      title: "Read 10 pages",
      purpose: `Daily learning momentum for: ${goal}`,
      category: "learning",
      preferred_time: ctx.secondTime,
      duration_minutes: 15,
      difficulty: "easy",
      fallback_habit: "Read one page.",
    });
  if (/meditat|mindful/.test(g))
    return base({
      title: "5-min breathing",
      purpose: `Anchor attention for: ${goal}`,
      category: "mind",
      duration_minutes: 5,
      difficulty: "micro",
      preferred_time: ctx.firstTime,
      fallback_habit: "10 slow breaths, eyes closed.",
    });
  if (/screen|phone|focus/.test(g))
    return base({
      title: "Phone-free first 30 min",
      purpose: `Protect focus for: ${goal}`,
      category: "productivity",
      preferred_time: "morning",
      duration_minutes: 30,
      difficulty: "medium",
      fallback_habit: "Phone face-down for 10 minutes.",
    });
  if (/water|hydrat/.test(g))
    return base({
      title: "3 water breaks",
      purpose: `Stay hydrated for: ${goal}`,
      category: "nutrition",
      duration_minutes: 2,
      difficulty: "micro",
      fallback_habit: "One glass at lunch.",
    });
  if (/journal|reflect/.test(g))
    return base({
      title: "3-line journal",
      purpose: `Daily reflection for: ${goal}`,
      category: "mind",
      preferred_time: "evening",
      duration_minutes: 5,
      difficulty: "easy",
      fallback_habit: "One sentence: 'Today I…'",
    });
  if (/project|ship|work|focus/.test(g))
    return base({
      title: "Deep-work block",
      purpose: `Protect focused time for: ${goal}`,
      category: "productivity",
      frequency: "weekdays",
      preferred_time: "morning",
      duration_minutes: 45,
      difficulty: ctx.lowEnergy ? "easy" : "medium",
      fallback_habit: "15 minutes on the one priority task.",
    });

  return base({ title: goal, purpose: `Make steady progress on: ${goal}` });
}
