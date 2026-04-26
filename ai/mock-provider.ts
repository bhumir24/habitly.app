import type { AIProvider } from "./provider";
import type {
  Adaptation,
  GeneratedHabit,
  GeneratedPlan,
  Habit,
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
    const habits = input.activeHabits;
    const logs = input.recentLogs;

    // Per-habit stats
    const habitStats = new Map<string, { done: number; skipped: number; rate: number | null }>();
    for (const h of habits) {
      const hLogs = logs.filter((l) => l.habit_id === h.id);
      const done = hLogs.filter((l) => l.status === "completed").length;
      const skipped = hLogs.filter((l) => l.status === "skipped").length;
      const total = done + skipped;
      habitStats.set(h.id, { done, skipped, rate: total > 0 ? done / total : null });
    }

    const totalDone = logs.filter((l) => l.status === "completed").length;
    const totalSkipped = logs.filter((l) => l.status === "skipped").length;
    const totalLogged = totalDone + totalSkipped;
    const overallRate = totalLogged > 0 ? Math.round((totalDone / totalLogged) * 100) : null;

    // Find the habit the user is explicitly asking about (name or category match)
    const mentionedHabit =
      habits.find((h) =>
        msg.includes(h.title.toLowerCase()) || msg.includes(h.category.toLowerCase())
      ) ?? habits[0];

    const micro = mentionedHabit?.fallback_habit ?? "2 minutes of movement";

    const lifeMode = input.profileContext.life_mode.replace(/_/g, " ");
    const energy = input.profileContext.energy_baseline;

    // --- Mood signal (overrides everything) ---
    if (input.mood !== undefined && input.mood <= 2) {
      return (
        `Rough one — honor it. Skip the full "${mentionedHabit?.title ?? "plan"}" and just do: ${micro}. ` +
        `One small rep keeps your identity intact. We’ll adapt from here.`
      );
    }
    if (input.mood !== undefined && input.mood >= 4) {
      const progressable = habits.find((h) => {
        const s = habitStats.get(h.id);
        return s?.rate !== null && s!.rate >= 0.8 && h.difficulty !== "hard";
      });
      return progressable
        ? `High energy — use it. Your "${progressable.title}" is at ${Math.round(habitStats.get(progressable.id)!.rate! * 100)}% — perfect time to push a little harder. Want me to bump the duration?`
        : `Good energy today. Lock in your habits in full — no shortcuts. ${overallRate !== null ? `You’re at ${overallRate}% overall this fortnight, keep that going.` : ""}`;
    }

    // --- Busy / no time ---
    if (/no time|too busy|packed|crazy day|overwhelm|no space/.test(msg)) {
      return (
        `Busy day. Run the 2-minute version: ${micro}. ` +
        `That protects the streak without stealing time from what’s urgent.`
      );
    }

    // --- Tired / low energy ---
    if (/tired|exhaust|drained|no energy|low energy|bad sleep|didn.t sleep|fatigue/.test(msg)) {
      return (
        `Energy is the real resource here. Your baseline is ${energy} — on low days, ` +
        `drop "${mentionedHabit?.title ?? "your hardest habit"}" to its fallback: ${micro}. ` +
        `Tomorrow you reset; don’t touch the long-term plan for one rough day.`
      );
    }

    // --- Missed / skipped ---
    if (/miss|skip|slip|broke|forgot|didn.t do|failed|behind|streak/.test(msg) || totalSkipped >= 3) {
      const worstHabit = habits.reduce<typeof habits[0] | undefined>((worst, h) => {
        const s = habitStats.get(h.id)!;
        const wS = worst ? habitStats.get(worst.id)! : null;
        if (s.done + s.skipped < 2) return worst;
        return !wS || (s.rate ?? 1) < (wS.rate ?? 1) ? h : worst;
      }, undefined) ?? mentionedHabit;

      const worstStat = worstHabit ? habitStats.get(worstHabit.id) : null;
      const rateStr = worstStat?.rate !== null && worstStat?.rate !== undefined
        ? ` (${Math.round(worstStat.rate * 100)}% completion)`
        : "";

      return (
        `Missing sessions is data, not failure. "${worstHabit?.title ?? "one habit"}"${rateStr} is your friction point. ` +
        `I’d drop it to micro for 5 days: ${worstHabit?.fallback_habit ?? micro}. ` +
        `Want me to draft that change?`
      );
    }

    // --- Motivation / procrastination ---
    if (/motivat|lazy|procrastinat|can.t|don.t want|not feeling|resistance|meh/.test(msg)) {
      return (
        `Motivation follows action — not the other way. Do ${micro} in the next 5 minutes. ` +
        `Just that, nothing more. Text me back when it’s done.`
      );
    }

    // --- Progression / want harder ---
    if (/progress|next level|harder|step up|advance|level up|challeng|grow/.test(msg)) {
      const ready = habits.find((h) => {
        const s = habitStats.get(h.id);
        return s?.rate !== null && s!.rate >= 0.75 && h.difficulty !== "hard";
      });
      if (ready) {
        const s = habitStats.get(ready.id)!;
        return (
          `"${ready.title}" is at ${Math.round(s.rate! * 100)}% — ready to progress. ` +
          `I’d add ~${Math.round(ready.duration_minutes * 0.3)} min and bump difficulty one step for a week. Reply "yes" to apply.`
        );
      }
      return (
        `Not quite yet — you need 75%+ completion on a habit before stepping up. ` +
        `${overallRate !== null ? `You’re at ${overallRate}% overall.` : "Get a few more weeks of logs first."} ` +
        `Focus on consistency; progression unlocks itself.`
      );
    }

    // --- Questions about a specific habit ---
    if (mentionedHabit && /\?|how|what|when|why|which|tell me|explain|stat|progress|doing/.test(msg)) {
      const s = habitStats.get(mentionedHabit.id)!;
      const rateStr = s.rate !== null ? `${Math.round(s.rate * 100)}%` : "no logs yet";

      if (/when|time|schedul/.test(msg)) {
        return (
          `"${mentionedHabit.title}" is set for ${mentionedHabit.preferred_time.replace(/_/g, " ")}. ` +
          (s.rate !== null && s.rate < 0.5
            ? `You’re only completing it ${Math.round(s.rate * 100)}% of the time — that window might not be working. Want to shift it?`
            : `Completion is ${rateStr} — that slot seems to be working for you.`)
        );
      }
      if (/how long|duration|minute/.test(msg)) {
        return (
          `"${mentionedHabit.title}" is ${mentionedHabit.duration_minutes} minutes. ` +
          `The fallback if time is short: ${mentionedHabit.fallback_habit ?? "2-minute version"}. ` +
          (s.rate !== null && s.rate < 0.5 ? `Given the low completion rate, the duration might be the blocker — want to halve it for a week?` : "")
        );
      }
      if (/stat|progress|complet|how am i|doing|rate/.test(msg)) {
        const total = s.done + s.skipped;
        if (total === 0) {
          return `No logs yet for "${mentionedHabit.title}". Let’s get a first data point — try it today and mark it.`;
        }
        return (
          `"${mentionedHabit.title}": ${s.done} completed, ${s.skipped} skipped over the last 14 days (${rateStr}). ` +
          (s.rate! < 0.5
            ? `Below 50% — the habit is likely too hard or timed wrong. Want to adjust?`
            : s.rate! >= 0.8
            ? `Strong. You may be ready to progress this one.`
            : `Solid middle ground — keep it for another week and see if it stabilises.`)
        );
      }
      // General question about a habit
      return (
        `"${mentionedHabit.title}" — ${mentionedHabit.duration_minutes}m, ${mentionedHabit.preferred_time.replace(/_/g, " ")}, ${mentionedHabit.difficulty}. ` +
        `Completion last 14 days: ${rateStr}. Fallback: ${mentionedHabit.fallback_habit ?? "—"}. ` +
        `What specifically would you like to change?`
      );
    }

    // --- Today / what to do now ---
    if (/today|right now|now|start|begin|where|what should|what do/.test(msg)) {
      const ordered = [...habits].sort((a, b) => {
        const order = ["early_morning", "morning", "midday", "afternoon", "evening", "night", "any"];
        return order.indexOf(a.preferred_time) - order.indexOf(b.preferred_time);
      });
      const first = ordered[0];
      return (
        `Start with "${first?.title ?? "your first habit"}" — ${first?.duration_minutes ?? 10} min, ${first?.preferred_time?.replace(/_/g, " ") ?? "now"}. ` +
        (ordered.length > 1 ? `After that: ${ordered.slice(1, 3).map((h) => `"${h.title}"`).join(", ")}. ` : "") +
        `If the full version is too much, the fallback is: ${first?.fallback_habit ?? micro}.`
      );
    }

    // --- Goals ---
    if (/goal|aim|target|trying to|want to|purpose|why/.test(msg)) {
      const goals = input.onboarding?.goals ?? [];
      return goals.length > 0
        ? `Your goals: ${goals.join("; ")}. Your current habits are the direct levers for those. Is there a goal you feel isn’t being served by the plan?`
        : `Set your goals during onboarding and I can tie every habit back to them specifically.`;
    }

    // --- Plan / schedule questions ---
    if (/plan|schedule|routine|change|adjust|tweak|restructure|overhaul/.test(msg)) {
      const heavyHabits = habits.filter((h) => h.duration_minutes > 20);
      return heavyHabits.length > 3
        ? `Your plan has ${habits.length} habits, ${heavyHabits.length} over 20 min — that’s dense for ${lifeMode} mode. I’d cut to the 2 non-negotiable ones. Which are they?`
        : `You have ${habits.length} active habits — reasonable for ${lifeMode} mode. What specific part of the schedule do you want to change?`;
    }

    // --- Blocker context ---
    if (input.blocker) {
      return (
        `Blocker noted: "${input.blocker}". Swap "${mentionedHabit?.title ?? "the affected habit"}" for its fallback today: ${micro}. ` +
        `What would need to change to remove that blocker tomorrow?`
      );
    }

    // --- Overall stats request ---
    if (/stat|overview|summary|how.*week|how.*fortnight|how.*doing/.test(msg)) {
      const lines = habits.map((h) => {
        const s = habitStats.get(h.id)!;
        const r = s.rate !== null ? `${Math.round(s.rate * 100)}%` : "no logs";
        return `"${h.title}": ${r}`;
      });
      return (
        `Last 14 days — ${totalDone} completed, ${totalSkipped} skipped (${overallRate ?? "—"}% overall).\n` +
        lines.join(" | ") +
        `. Biggest lever: focus on the habit below 60%.`
      );
    }

    // --- Flexible fallback: reference actual data ---
    const lowestHabit = habits.reduce<typeof habits[0] | undefined>((worst, h) => {
      const s = habitStats.get(h.id)!;
      const wS = worst ? habitStats.get(worst.id)! : null;
      if (s.rate === null) return worst;
      return !wS || s.rate < (wS.rate ?? 1) ? h : worst;
    }, undefined);

    const statsLine = overallRate !== null
      ? `You’re at ${overallRate}% completion over the last 14 days. `
      : "";

    return (
      `${statsLine}` +
      (lowestHabit && habitStats.get(lowestHabit.id)?.rate !== null
        ? `Biggest friction: "${lowestHabit.title}" (${Math.round(habitStats.get(lowestHabit.id)!.rate! * 100)}%). `
        : ``) +
      `In ${lifeMode} mode with ${habits.length} active habits, the most useful move today is: ${micro}. ` +
      `Ask me about any specific habit, goal, or what to do right now.`
    );
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
