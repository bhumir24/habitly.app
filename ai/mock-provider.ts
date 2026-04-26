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

    // Habit explicitly named or categorised in the message — NOT a blanket fallback to habits[0]
    const explicitHabit = habits.find(
      (h) => msg.includes(h.title.toLowerCase()) || msg.includes(h.category.toLowerCase())
    );
    // For micro-action suggestions we still want a sensible default
    const contextHabit = explicitHabit ?? habits[0];
    const micro = contextHabit?.fallback_habit ?? "a 2-minute version of your top habit";

    const lifeMode = input.profileContext.life_mode.replace(/_/g, " ");
    const energy = input.profileContext.energy_baseline;

    // Last coach message — used to handle confirmations like "yes"
    const lastCoachMsg = [...input.history].reverse().find((m) => m.role === "assistant")?.content ?? "";

    // ── 1. Mood signal (highest priority) ──────────────────────────────────
    if (input.mood !== undefined && input.mood <= 2) {
      return (
        `Rough one — honor it. Skip the full "${contextHabit?.title ?? "plan"}" and just do: ${micro}. ` +
        `One small rep keeps your identity intact. We’ll adapt from here.`
      );
    }
    if (input.mood !== undefined && input.mood >= 4) {
      const progressable = habits.find((h) => {
        const s = habitStats.get(h.id);
        return s?.rate !== null && s!.rate >= 0.8 && h.difficulty !== "hard";
      });
      return progressable
        ? `High energy — use it. "${progressable.title}" is at ${Math.round(habitStats.get(progressable.id)!.rate! * 100)}% — perfect time to push a little harder. Want me to bump the duration?`
        : `Good energy today. Lock in your habits in full — no shortcuts. ${overallRate !== null ? `You’re at ${overallRate}% overall this fortnight.` : ""}`;
    }

    // ── 2. "Yes / sure / apply / do it" — confirm what coach just proposed ─
    if (/^(yes|yeah|sure|ok|okay|apply|do it|go ahead|sounds good|yep)[\s!.]*$/.test(msg.trim())) {
      if (/bump|progress|duration|step up/i.test(lastCoachMsg)) {
        const readyHabit = habits.find((h) => {
          const s = habitStats.get(h.id);
          return s?.rate !== null && s!.rate >= 0.75;
        }) ?? contextHabit;
        return (
          `Got it. I’ve noted to increase "${readyHabit?.title ?? "that habit"}" by ~30% duration. ` +
          `Head to the habit page and tap Edit to apply it, or ask me to draft the exact numbers.`
        );
      }
      if (/drop|micro|simpler|reduce|lighten|fallback/i.test(lastCoachMsg)) {
        return (
          `Done — switching to micro mode for 5 days makes sense. ` +
          `Open the habit, lower the difficulty, and set duration to ${Math.max(2, Math.round((contextHabit?.duration_minutes ?? 10) / 2))} min. ` +
          `Check back in on day 5.`
        );
      }
      if (/shift|time|window|earlier|later/i.test(lastCoachMsg)) {
        return (
          `Good call. Go to the habit settings and switch the preferred time. ` +
          `Even a 1-hour shift can change completion dramatically — give it a week.`
        );
      }
      if (/add|gym|meditat|new habit|generate|create/i.test(lastCoachMsg)) {
        return (
          `To add a new habit, go to the Dashboard and tap "+ New Habit". ` +
          `I’d suggest starting it at "easy" difficulty so it doesn’t compete with your existing plan.`
        );
      }
      return (
        `Got it. Make the change in the habit settings and log your first attempt — ` +
        `that’s the only way to know if it sticks. Come back in a few days and we’ll review.`
      );
    }

    // ── 3. What can you do / help / capabilities ───────────────────────────
    if (/what can you (do|help)|how can you (help|assist)|what are you|capabilities|help me/.test(msg)) {
      const habitList = habits.map((h) => `"${h.title}"`).join(", ");
      return (
        `I know your habits (${habitList || "none yet"}), recent logs, mood, and goals. ` +
        `Ask me: how you’re doing on a specific habit, what to do today, why you’re stuck, ` +
        `whether to progress or ease off, or to suggest a schedule change. I’ll always answer based on your real data.`
      );
    }

    // ── 4. Generate / add / create / regenerate plan ───────────────────────
    if (/generate|add.*(habit|gym|meditat|workout)|create.*(habit|plan)|new habit|regenerate|rebuild.*plan/.test(msg)) {
      const wantsMeditation = /meditat/.test(msg);
      const wantsGym = /gym|workout|exercise|strength/.test(msg);
      const timeMatch = msg.match(/(\d{1,2})[:\s]?(\d{2})?\s*(am|pm)?/);
      const timeStr = timeMatch ? timeMatch[0] : null;

      const suggestions: string[] = [];
      if (wantsGym) {
        suggestions.push(
          `Gym session — ${timeStr ? `${timeStr}, ` : ""}45 min, movement category, medium difficulty. ` +
          `Fallback: 10 min home bodyweight circuit.`
        );
      }
      if (wantsMeditation) {
        suggestions.push(
          `Meditation — 10 min, morning, mind category, easy difficulty. ` +
          `Fallback: 5 slow breaths at your desk.`
        );
      }
      if (suggestions.length === 0) {
        return (
          `To add a habit: go to Dashboard → "+ New Habit" and fill in the details. ` +
          `Tell me specifically what you want to add (name, time, duration) and I’ll give you the exact settings to use.`
        );
      }
      return (
        `Here’s what I’d add:\n` +
        suggestions.map((s, i) => `${i + 1}. ${s}`).join("\n") +
        `\nGo to Dashboard → "+ New Habit" to create ${suggestions.length > 1 ? "each one" : "it"}. ` +
        `Reply "yes" once added and I’ll help you tune the plan.`
      );
    }

    // ── 5. Any more suggestions / other ideas ─────────────────────────────
    if (/any (other|more)|what else|other suggestion|more tip|another/.test(msg)) {
      const underperforming = habits.filter((h) => {
        const s = habitStats.get(h.id);
        return s?.rate !== null && s!.rate < 0.7;
      });
      if (underperforming.length > 0) {
        const h = underperforming[0];
        const s = habitStats.get(h.id)!;
        return (
          `"${h.title}" is at ${Math.round(s.rate! * 100)}% — that’s the next thing to fix. ` +
          `Options: shift the time slot, drop to the fallback (${h.fallback_habit ?? "2-min version"}), or reduce frequency. Which direction feels right?`
        );
      }
      const progressable = habits.find((h) => {
        const s = habitStats.get(h.id);
        return s?.rate !== null && s!.rate >= 0.85 && h.difficulty !== "hard";
      });
      if (progressable) {
        return (
          `Everything’s looking solid. "${progressable.title}" is ready to progress — ` +
          `bump the duration by ~30% and increase difficulty one notch. Want to do that?`
        );
      }
      return (
        `You’re consistent across the board. The next move is to add a new habit or increase one. ` +
        `What goal area feels neglected right now?`
      );
    }

    // ── 6. Busy / no time ──────────────────────────────────────────────────
    if (/no time|too busy|packed|crazy day|overwhelm|no space/.test(msg)) {
      return (
        `Busy day. Run the 2-minute version: ${micro}. ` +
        `That protects the streak without stealing time from what’s urgent.`
      );
    }

    // ── 7. Tired / sore / low energy ──────────────────────────────────────
    if (/tired|exhaust|drained|no energy|low energy|bad sleep|didn.t sleep|fatigue|sore|shiver|ache/.test(msg)) {
      const isPhysical = /sore|shiver|ache|gym|workout|arms|legs|muscle/.test(msg);
      const movementHabit = habits.find((h) => h.category === "movement");
      const targetHabit = isPhysical ? (movementHabit ?? contextHabit) : contextHabit;
      return isPhysical
        ? (
          `Physical fatigue after training is recovery time, not a setback. ` +
          `Skip "${targetHabit?.title ?? "any movement habit"}" today — rest IS the workout. ` +
          `Light stretching or a walk is fine if you want to move. Everything else in your plan stays.`
        )
        : (
          `Energy is the real resource. Your baseline is ${energy} — on low days, ` +
          `drop "${targetHabit?.title ?? "your hardest habit"}" to its fallback: ${targetHabit?.fallback_habit ?? micro}. ` +
          `Tomorrow you reset; don’t change the long-term plan for one rough day.`
        );
    }

    // ── 8. Missed / skipped ────────────────────────────────────────────────
    if (/miss|skip|slip|broke|forgot|didn.t do|failed|behind|streak/.test(msg) || totalSkipped >= 3) {
      const worstHabit = habits.reduce<typeof habits[0] | undefined>((worst, h) => {
        const s = habitStats.get(h.id)!;
        const wS = worst ? habitStats.get(worst.id)! : null;
        if (s.done + s.skipped < 2) return worst;
        return !wS || (s.rate ?? 1) < (wS.rate ?? 1) ? h : worst;
      }, undefined) ?? contextHabit;

      const worstStat = worstHabit ? habitStats.get(worstHabit.id) : null;
      const rateStr =
        worstStat?.rate !== null && worstStat?.rate !== undefined
          ? ` (${Math.round(worstStat.rate * 100)}% completion)`
          : "";

      return (
        `Missing sessions is data, not failure. "${worstHabit?.title ?? "one habit"}"${rateStr} is your friction point. ` +
        `I’d drop it to micro for 5 days: ${worstHabit?.fallback_habit ?? micro}. ` +
        `Want me to draft that change?`
      );
    }

    // ── 9. Motivation / procrastination ────────────────────────────────────
    if (/motivat|lazy|procrastinat|can.t|don.t want|not feeling|resistance|meh/.test(msg)) {
      return (
        `Motivation follows action — not the other way. Do ${micro} in the next 5 minutes. ` +
        `Just that, nothing more. Text me back when it’s done.`
      );
    }

    // ── 10. Progression ───────────────────────────────────────────────────
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
        `Not quite yet — you need 75%+ on a habit before stepping up. ` +
        `${overallRate !== null ? `You’re at ${overallRate}% overall.` : "Get a few more weeks of logs first."} ` +
        `Consistency is the prerequisite.`
      );
    }

    // ── 11. Question about an explicitly named habit ───────────────────────
    if (explicitHabit) {
      const s = habitStats.get(explicitHabit.id)!;
      const rateStr = s.rate !== null ? `${Math.round(s.rate * 100)}%` : "no logs yet";

      if (/when|time|schedul/.test(msg)) {
        return (
          `"${explicitHabit.title}" is set for ${explicitHabit.preferred_time.replace(/_/g, " ")}. ` +
          (s.rate !== null && s.rate < 0.5
            ? `Only ${Math.round(s.rate * 100)}% completion — that window might not be working. Want to shift it?`
            : `Completion is ${rateStr} — the slot seems to be working.`)
        );
      }
      if (/how long|duration|minute/.test(msg)) {
        return (
          `"${explicitHabit.title}" is ${explicitHabit.duration_minutes} minutes. ` +
          `Fallback: ${explicitHabit.fallback_habit ?? "2-minute version"}. ` +
          (s.rate !== null && s.rate < 0.5
            ? `Low completion rate suggests the duration is the blocker — want to halve it for a week?`
            : "")
        );
      }
      if (/stat|progress|complet|how am i|doing|rate/.test(msg)) {
        const total = s.done + s.skipped;
        if (total === 0) return `No logs yet for "${explicitHabit.title}". Try it today and mark it — that’s the first data point.`;
        return (
          `"${explicitHabit.title}": ${s.done} completed, ${s.skipped} skipped (${rateStr}) over 14 days. ` +
          (s.rate! < 0.5
            ? `Below 50% — likely too hard or mistimed. Want to adjust?`
            : s.rate! >= 0.8
            ? `Strong. May be ready to progress.`
            : `Solid middle ground — keep it another week.`)
        );
      }
      return (
        `"${explicitHabit.title}" — ${explicitHabit.duration_minutes}m, ${explicitHabit.preferred_time.replace(/_/g, " ")}, ${explicitHabit.difficulty} difficulty. ` +
        `Completion: ${rateStr}. Fallback: ${explicitHabit.fallback_habit ?? "—"}. ` +
        `What do you want to change?`
      );
    }

    // ── 12. Today / what to do now ────────────────────────────────────────
    if (/today|right now|now|start|begin|what should|what do/.test(msg)) {
      const ordered = [...habits].sort((a, b) => {
        const order = ["early_morning", "morning", "midday", "afternoon", "evening", "night", "any"];
        return order.indexOf(a.preferred_time) - order.indexOf(b.preferred_time);
      });
      const first = ordered[0];
      return (
        `Start with "${first?.title ?? "your first habit"}" — ${first?.duration_minutes ?? 10} min, ${first?.preferred_time?.replace(/_/g, " ") ?? "now"}. ` +
        (ordered.length > 1 ? `After: ${ordered.slice(1, 3).map((h) => `"${h.title}"`).join(", ")}. ` : "") +
        `Fallback if needed: ${first?.fallback_habit ?? micro}.`
      );
    }

    // ── 13. Goals ─────────────────────────────────────────────────────────
    if (/goal|aim|target|trying to|purpose|why/.test(msg)) {
      const goals = input.onboarding?.goals ?? [];
      return goals.length > 0
        ? `Your goals: ${goals.join("; ")}. Your habits are the direct levers. Is there a goal that feels un-served by the current plan?`
        : `Set your goals during onboarding and I’ll tie each habit back to them specifically.`;
    }

    // ── 14. Plan / schedule tweaks ────────────────────────────────────────
    if (/plan|schedule|routine|change|adjust|tweak|restructure|overhaul/.test(msg)) {
      const heavyHabits = habits.filter((h) => h.duration_minutes > 20);
      return heavyHabits.length > 3
        ? `Your plan is dense — ${habits.length} habits, ${heavyHabits.length} over 20 min. For ${lifeMode} mode I’d cut to the 2 non-negotiable ones. Which are they?`
        : `${habits.length} active habits is reasonable for ${lifeMode} mode. Tell me the specific change: add a habit, shift a time, lower a duration, or drop one entirely?`;
    }

    // ── 15. Blocker context ───────────────────────────────────────────────
    if (input.blocker) {
      return (
        `Blocker: "${input.blocker}". Swap "${contextHabit?.title ?? "the affected habit"}" for its fallback today: ${micro}. ` +
        `What would need to change to remove that blocker tomorrow?`
      );
    }

    // ── 16. Stats / overview ──────────────────────────────────────────────
    if (/stat|overview|summary|how.*week|how.*fortnight|how.*doing/.test(msg)) {
      const lines = habits.map((h) => {
        const s = habitStats.get(h.id)!;
        const r = s.rate !== null ? `${Math.round(s.rate * 100)}%` : "no logs";
        return `"${h.title}": ${r}`;
      });
      return (
        `Last 14 days — ${totalDone} completed, ${totalSkipped} skipped (${overallRate ?? "—"}% overall). ` +
        lines.join(" | ") +
        `. Focus first on any habit below 60%.`
      );
    }

    // ── 17. Flexible fallback — only show "friction" if rate is actually low ─
    const lowestHabit = habits.reduce<typeof habits[0] | undefined>((worst, h) => {
      const s = habitStats.get(h.id)!;
      const wS = worst ? habitStats.get(worst.id)! : null;
      if (s.rate === null || s.rate >= 0.7) return worst;
      return !wS || s.rate < (wS.rate ?? 1) ? h : worst;
    }, undefined);

    const statsLine = overallRate !== null ? `You’re at ${overallRate}% completion over the last 14 days. ` : "";
    const frictionLine =
      lowestHabit && habitStats.get(lowestHabit.id)?.rate !== null
        ? `Biggest friction: "${lowestHabit.title}" (${Math.round(habitStats.get(lowestHabit.id)!.rate! * 100)}%). `
        : overallRate !== null && overallRate >= 90
        ? `All habits looking strong. `
        : "";

    return (
      statsLine +
      frictionLine +
      `In ${lifeMode} mode with ${habits.length} active habits, the most useful move today is: ${micro}. ` +
      `Ask me about a specific habit, what to do today, or how to change the plan.`
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
