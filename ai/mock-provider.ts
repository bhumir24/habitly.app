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
    const msg = input.userMessage.toLowerCase().trim();
    const habits = input.activeHabits;
    const logs = input.recentLogs;

    // ── Per-habit stats ────────────────────────────────────────────────────
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

    const explicitHabit = habits.find((h) => {
      const title = h.title.toLowerCase();
      if (msg.includes(title) || msg.includes(h.category.toLowerCase())) return true;
      // partial word match: "walking" matches "Daily walk", "workout" matches "Workout session"
      return title.split(/\s+/).some((w) => w.length > 3 && msg.includes(w));
    });
    const contextHabit = explicitHabit ?? habits[0];
    const micro = contextHabit?.fallback_habit ?? "a 2-minute version of your top habit";
    const lifeMode = input.profileContext.life_mode.replace(/_/g, " ");
    const energy = input.profileContext.energy_baseline;
    const lastCoachMsg = [...input.history].reverse().find((m) => m.role === "assistant")?.content ?? "";

    // ── 0. Greeting / small talk ───────────────────────────────────────────
    if (/^(hi|hello|hey|good morning|good afternoon|good evening|howdy|sup|what’?s up|hiya)[!.?]*$/.test(msg)) {
      if (habits.length === 0) {
        return `Hey! I’m your AI habit coach. You don’t have any habits set up yet — head to the Dashboard and click "+ New Habit" to add your first one. Once you do, I can give you real advice based on your data.`;
      }
      const habitList = habits.slice(0, 3).map((h) => `"${h.title}"`).join(", ");
      const opener = overallRate !== null
        ? `You’re at ${overallRate}% completion over the last 14 days.`
        : `No logs yet — let’s change that today.`;
      return `Hey! ${opener} Your active habits: ${habitList}${habits.length > 3 ? ` and ${habits.length - 3} more` : ""}. What can I help you with?`;
    }

    // ── 0b. No habits yet ─────────────────────────────────────────────────
    if (habits.length === 0) {
      return `You don’t have any active habits yet. Go to the Dashboard and click "+ New Habit" to add your first one, or use the AI Suggestions tab to get a personalised plan. Once you do, I can give you real coaching based on your data.`;
    }

    // ── 1. Mood signal ─────────────────────────────────────────────────────
    if (input.mood !== undefined && input.mood <= 2) {
      return `Rough one — honor it. Skip the full "${contextHabit?.title ?? "plan"}" and just do: ${micro}. One small rep keeps your identity intact. We’ll adapt from here.`;
    }
    if (input.mood !== undefined && input.mood >= 4) {
      const progressable = habits.find((h) => {
        const s = habitStats.get(h.id);
        return s?.rate !== null && s!.rate >= 0.8 && h.difficulty !== "hard";
      });
      return progressable
        ? `High energy — use it. "${progressable.title}" is at ${Math.round(habitStats.get(progressable.id)!.rate! * 100)}% — perfect time to push a little harder. Want me to bump the duration?`
        : `Good energy today. Lock in your habits in full — no shortcuts. ${overallRate !== null ? `You’re at ${overallRate}% overall.` : ""}`;
    }

    // ── 2. Confirmation ────────────────────────────────────────────────────
    if (/^(yes|yeah|sure|ok|okay|apply|do it|go ahead|sounds good|yep|let’?s do it)[!.?]*$/.test(msg)) {
      if (/bump|progress|duration|step up/i.test(lastCoachMsg)) {
        const readyHabit = habits.find((h) => {
          const s = habitStats.get(h.id);
          return s?.rate !== null && s!.rate >= 0.75;
        }) ?? contextHabit;
        return `Got it — bump "${readyHabit?.title ?? "the habit"}" duration by ~30% and move difficulty one step up. Dashboard → tap the habit card → Edit to apply it.`;
      }
      if (/drop|micro|simpler|reduce|lighten|fallback/i.test(lastCoachMsg)) {
        return `Done. Dashboard → tap the habit → Edit → lower the difficulty and set duration to ${Math.max(2, Math.round((contextHabit?.duration_minutes ?? 10) / 2))} min. Check back in on day 5.`;
      }
      if (/shift|time|window|earlier|later/i.test(lastCoachMsg)) {
        return `Good call. Dashboard → tap the habit → Edit → change Preferred Time. Even a 1-hour shift can change completion dramatically — give it a week.`;
      }
      if (/add|track|create|habit/i.test(lastCoachMsg)) {
        return `Use the "+ Add to plan" button above, or go to Dashboard → "+ New Habit". Start at "easy" difficulty so it doesn’t crowd your existing plan.`;
      }
      return `Got it. Dashboard → tap the habit card → Edit. Log your first attempt after the change — that’s the only way to know if it sticks.`;
    }

    // ── 3. What are my habits / list habits ───────────────────────────────
    if (/what (are|is) (my|the) habit|list (my )?habit|show (me )?(my )?habit|how many habit/.test(msg)) {
      const lines = habits.map((h) => {
        const s = habitStats.get(h.id)!;
        const r = s.rate !== null ? `${Math.round(s.rate * 100)}%` : "no logs";
        return `• "${h.title}" — ${h.duration_minutes}m, ${h.preferred_time.replace(/_/g, " ")}, ${h.difficulty} (${r})`;
      });
      return `You have ${habits.length} active habit${habits.length !== 1 ? "s" : ""}:\n${lines.join("\n")}\n\nAsk me about any of them for details.`;
    }

    // ── 4. What can you do / capabilities ─────────────────────────────────
    if (/what can you (do|help)|how can you (help|assist)|what are you|capabilities/.test(msg)) {
      const habitList = habits.map((h) => `"${h.title}"`).join(", ");
      return `I know your habits (${habitList}), recent logs, mood, and goals. Ask me: how you’re doing on a habit, what to do today, why you’re stuck, or ask me to add a new habit and I’ll set it up for you right here.`;
    }

    // ── 5. Add / track a specific new habit ───────────────────────────────
    if (/^(add|track|i want to (add|track|start)|can you add|create)\s+.{3,}/.test(msg) ||
        /add.*(habit|routine|practice)|track.*(habit|daily|routine)|i want to start|new habit for/.test(msg)) {
      const feelingLow = /feel(ing)?\s*(low|tired|bad|rough|down|stressed|exhaust)|not (great|good)|rough day/.test(msg);
      const prefix = feelingLow
        ? `Rough day — got it. Setting the bar low is smart. `
        : "";
      return prefix + habitAction(msg, input.onboarding?.preferred_times?.[0] ?? "morning");
    }

    // ── 6. Navigation / where to find things ──────────────────────────────
    if (/where (is|are|can i find|do i find)|how (do i|can i) (edit|find|navigate|go to)/.test(msg)) {
      if (/habit|edit/.test(msg)) {
        return `To edit a habit: Dashboard → tap the habit card → Edit (you can change title, time, duration, difficulty, fallback). To add one: "+ New Habit" button on the Dashboard, or ask me to add it here.`;
      }
      if (/settings|account|profile/.test(msg)) {
        return `Account settings are in Settings (left sidebar) — name, timezone, energy level, life mode.`;
      }
      return `App pages: Dashboard (habits + logging), AI Coach (here), Insights (weekly trends), Settings (account). Need to find something specific?`;
    }

    // ── 7. Any more suggestions / other ideas ─────────────────────────────
    if (/any (other|more)|what else|other suggestion|more tip|another idea/.test(msg)) {
      const underperforming = habits.filter((h) => {
        const s = habitStats.get(h.id);
        return s?.rate !== null && s!.rate < 0.7;
      });
      if (underperforming.length > 0) {
        const h = underperforming[0];
        const s = habitStats.get(h.id)!;
        return `"${h.title}" is at ${Math.round(s.rate! * 100)}% — that’s the next thing to fix. Options: shift the time slot, drop to the fallback (${h.fallback_habit ?? "2-min version"}), or reduce frequency. Which direction feels right?`;
      }
      const progressable = habits.find((h) => {
        const s = habitStats.get(h.id);
        return s?.rate !== null && s!.rate >= 0.85 && h.difficulty !== "hard";
      });
      if (progressable) {
        return `Everything looks solid. "${progressable.title}" is at ${Math.round(habitStats.get(progressable.id)!.rate! * 100)}% — ready to progress. Want me to bump the duration?`;
      }
      return `You’re consistent across the board. The next move is to add a new habit or increase one. What goal area feels neglected right now?`;
    }

    // ── 8. Busy / no time ─────────────────────────────────────────────────
    if (/no time|too busy|packed|crazy day|overwhelm|no space/.test(msg)) {
      return `Busy day — run the 2-minute version: ${micro}. That protects the streak without stealing time from what’s urgent.`;
    }

    // ── 9. Tired / sore / low energy ──────────────────────────────────────
    if (/tired|exhaust|drained|no energy|low energy|bad sleep|didn.t sleep|fatigue|sore|ache/.test(msg)) {
      const isPhysical = /sore|ache|gym|workout|arms|legs|muscle/.test(msg);
      const movementHabit = habits.find((h) => h.category === "movement");
      const targetHabit = isPhysical ? (movementHabit ?? contextHabit) : contextHabit;
      return isPhysical
        ? `Physical fatigue after training is recovery, not failure. Skip "${targetHabit?.title ?? "movement"}" today — rest IS the workout. Light stretching is fine. Everything else in your plan stays.`
        : `Energy is the real resource. Your baseline is ${energy} — on low days, drop "${targetHabit?.title ?? "your hardest habit"}" to its fallback: ${targetHabit?.fallback_habit ?? micro}. Tomorrow you reset; don’t change the long-term plan for one rough day.`;
    }

    // ── 10. Missed / skipped — only fires when message is about missing ────
    if (/miss|skip|slip|broke.*streak|forgot|didn.t do|failed|behind on|fell off/.test(msg)) {
      const worstHabit = habits.reduce<typeof habits[0] | undefined>((worst, h) => {
        const s = habitStats.get(h.id)!;
        const wS = worst ? habitStats.get(worst.id)! : null;
        if (s.done + s.skipped < 2) return worst;
        return !wS || (s.rate ?? 1) < (wS.rate ?? 1) ? h : worst;
      }, undefined) ?? contextHabit;

      const worstStat = worstHabit ? habitStats.get(worstHabit.id) : null;
      const rateStr = worstStat?.rate != null ? ` (${Math.round(worstStat.rate * 100)}% completion)` : "";

      return `Missing sessions is data, not failure. "${worstHabit?.title ?? "one habit"}"${rateStr} is your friction point. I’d drop it to micro for 5 days: ${worstHabit?.fallback_habit ?? micro}. Want me to draft that change?`;
    }

    // ── 11. Motivation / procrastination ──────────────────────────────────
    if (/motivat|lazy|procrastinat|can.t (do|start|get)|don.t want|not feeling|resistance|meh|stuck/.test(msg)) {
      return `Motivation follows action — not the other way. Do ${micro} in the next 5 minutes. Just that, nothing more. Text me back when it’s done.`;
    }

    // ── 12. Progression ───────────────────────────────────────────────────
    if (/progress|next level|step up|advance|level up|challeng|make.*harder|increase/.test(msg)) {
      const ready = habits.find((h) => {
        const s = habitStats.get(h.id);
        return s?.rate !== null && s!.rate >= 0.75 && h.difficulty !== "hard";
      });
      if (ready) {
        const s = habitStats.get(ready.id)!;
        return `"${ready.title}" is at ${Math.round(s.rate! * 100)}% — ready to progress. I’d add ~${Math.round(ready.duration_minutes * 0.3)} min and bump difficulty one step for a week. Reply "yes" to apply.`;
      }
      return `Not quite yet — you need 75%+ on a habit before stepping up. ${overallRate !== null ? `You’re at ${overallRate}% overall.` : "Get a few more weeks of logs first."} Consistency is the prerequisite.`;
    }

    // ── 13. Question about a specific habit ───────────────────────────────
    if (explicitHabit) {
      const s = habitStats.get(explicitHabit.id)!;
      const rateStr = s.rate !== null ? `${Math.round(s.rate * 100)}%` : "no logs yet";

      if (/when|time|schedul|recommend.*time|best time/.test(msg)) {
        const currentWindow = explicitHabit.preferred_time.replace(/_/g, " ");
        if (s.rate === null) {
          return `"${explicitHabit.title}" is set for ${currentWindow} — no logs yet, so give it a week there first. Morning tends to have the highest completion for most people since willpower is freshest. If it still feels hard after 5 days, try shifting it.`;
        }
        return `"${explicitHabit.title}" is set for ${currentWindow}. ${
          s.rate < 0.5
            ? `Only ${Math.round(s.rate * 100)}% completion — that window likely isn't working. Try shifting it to morning if it isn't already; that's where most people have the highest follow-through. Want to move it?`
            : s.rate < 0.75
            ? `${Math.round(s.rate * 100)}% completion — decent but room to improve. If it's in the evening, try moving it earlier before decision fatigue sets in.`
            : `${rateStr} completion — the ${currentWindow} slot is working. Keep it there.`
        }`;
      }
      if (/how long|duration|minute/.test(msg)) {
        return `"${explicitHabit.title}" is ${explicitHabit.duration_minutes} minutes. Fallback: ${explicitHabit.fallback_habit ?? "2-minute version"}. ${s.rate !== null && s.rate < 0.5 ? `Low completion suggests the duration is the blocker — want to halve it for a week?` : ""}`;
      }
      if (/stat|progress|complet|how am i|doing|rate/.test(msg)) {
        const total = s.done + s.skipped;
        if (total === 0) return `No logs yet for "${explicitHabit.title}". Try it today and mark it — that’s the first data point.`;
        return `"${explicitHabit.title}": ${s.done} completed, ${s.skipped} skipped (${rateStr}) over 14 days. ${s.rate! < 0.5 ? `Below 50% — likely too hard or mistimed. Want to adjust?` : s.rate! >= 0.8 ? `Strong. May be ready to progress.` : `Solid middle ground — keep it another week.`}`;
      }
      if (/improve|better|consistent|fix|help with/.test(msg)) {
        if (s.rate === null) {
          return `No logs yet for "${explicitHabit.title}". Best way to improve: log it today, even if you only do the fallback (${explicitHabit.fallback_habit ?? "2-min version"}). Data first, then I can give you specific advice.`;
        }
        const tip = s.rate < 0.5
          ? `At ${Math.round(s.rate * 100)}% it's struggling — drop duration to ${Math.max(2, Math.round(explicitHabit.duration_minutes / 2))} min for a week and rebuild the streak.`
          : s.rate < 0.75
          ? `At ${Math.round(s.rate * 100)}% — solid but not locked in. Try pairing it with something you already do (habit stacking). What comes before or after it naturally?`
          : `At ${Math.round(s.rate * 100)}% it's strong. Ready to progress? Add ~${Math.round(explicitHabit.duration_minutes * 0.3)} min to the duration.`;
        return `"${explicitHabit.title}" — ${explicitHabit.preferred_time.replace(/_/g, " ")}, ${explicitHabit.duration_minutes} min. ${tip}`;
      }
      return `"${explicitHabit.title}" — ${explicitHabit.duration_minutes}m, ${explicitHabit.preferred_time.replace(/_/g, " ")}, ${explicitHabit.difficulty} difficulty. Completion: ${rateStr}. Fallback: ${explicitHabit.fallback_habit ?? "—"}. What do you want to change?`;
    }

    // ── 14. Today / what to do now ────────────────────────────────────────
    if (/today|right now|what should i do|what do i do|where (do i|should i) start|get started/.test(msg)) {
      const ordered = [...habits].sort((a, b) => {
        const order = ["early_morning", "morning", "midday", "afternoon", "evening", "night", "any"];
        return order.indexOf(a.preferred_time) - order.indexOf(b.preferred_time);
      });
      const first = ordered[0];
      return `Start with "${first?.title ?? "your first habit"}" — ${first?.duration_minutes ?? 10} min, ${first?.preferred_time?.replace(/_/g, " ") ?? "now"}. ${ordered.length > 1 ? `After: ${ordered.slice(1, 3).map((h) => `"${h.title}"`).join(", ")}. ` : ""}Fallback if needed: ${first?.fallback_habit ?? micro}.`;
    }

    // ── 15. Goals ─────────────────────────────────────────────────────────
    if (/\bgoal|aim|target|trying to|purpose|why (am i|do i|are we)\b/.test(msg)) {
      const goals = input.onboarding?.goals ?? [];
      return goals.length > 0
        ? `Your goals: ${goals.join("; ")}. Your habits are the direct levers. Is there a goal that feels un-served by the current plan?`
        : `You haven’t set goals yet. Go through onboarding (Settings) and I’ll tie each habit back to them specifically.`;
    }

    // ── 16. Plan / schedule tweaks ────────────────────────────────────────
    if (/\b(change|adjust|tweak|restructure|overhaul|rework|modify)\b.*(plan|habit|schedule|routine)|my plan|(too many|too few) habit/.test(msg)) {
      const heavyHabits = habits.filter((h) => h.duration_minutes > 20);
      return heavyHabits.length > 3
        ? `Your plan is dense — ${habits.length} habits, ${heavyHabits.length} over 20 min. For ${lifeMode} mode I’d cut to the 2 non-negotiable ones. Which are they? (Dashboard → tap a habit → Edit to change or deactivate.)`
        : `${habits.length} active habits is reasonable for ${lifeMode} mode. Tell me the specific change: add a habit, shift a time, lower a duration, or drop one entirely?`;
    }

    // ── 17. Stats / overview ──────────────────────────────────────────────
    if (/\b(stat|overview|summary|how.*(week|fortnight|month)|progress report|how am i doing)\b/.test(msg)) {
      const lines = habits.map((h) => {
        const s = habitStats.get(h.id)!;
        const r = s.rate !== null ? `${Math.round(s.rate * 100)}%` : "no logs";
        return `• "${h.title}": ${r}`;
      });
      return `Last 14 days — ${totalDone} completed, ${totalSkipped} skipped (${overallRate ?? "—"}% overall).\n${lines.join("\n")}\nFocus first on any habit below 60%.`;
    }

    // ── 18. Blocker context (from UI field) ───────────────────────────────
    if (input.blocker) {
      return `Blocker: "${input.blocker}". Swap "${contextHabit?.title ?? "the affected habit"}" for its fallback today: ${micro}. What would need to change to remove that blocker tomorrow?`;
    }

    // ── 19. Acknowledgements (thanks, great, perfect, etc.) ───────────────
    if (/^(thanks|thank you|thx|ty|great|perfect|awesome|nice|cool|got it|makes sense|ok cool|sounds good|that helps|helpful)[!.?]*$/i.test(msg)) {
      const lowestAck = habits.find((h) => {
        const s = habitStats.get(h.id);
        return s?.rate !== null && s!.rate < 0.6;
      });
      return lowestAck
        ? `Anytime. One thing to keep an eye on: "${lowestAck.title}" is at ${Math.round(habitStats.get(lowestAck.id)!.rate! * 100)}% — that’s the next friction point to address.`
        : `Anytime. Keep logging — consistency compounds. Let me know if anything comes up.`;
    }

    // ── 20. What should I focus on / what’s most important ────────────────
    if (/focus|priorit|most important|what (should|do) i (work on|do first|start with)|where (should|do) i (put|spend)|what matters/.test(msg)) {
      const lowestFocus = habits.find((h) => {
        const s = habitStats.get(h.id);
        return s?.rate !== null && s!.rate < 0.65;
      });
      if (lowestFocus) {
        const s = habitStats.get(lowestFocus.id)!;
        return `Focus on "${lowestFocus.title}" — it’s your weakest at ${Math.round(s.rate! * 100)}%. Everything else can hold. Fix the friction there first: either shift the time slot or drop it to its fallback (${lowestFocus.fallback_habit ?? "2-min version"}) for a week to rebuild the streak.`;
      }
      const best = [...habits].sort((a, b) => {
        const sa = habitStats.get(a.id)!, sb = habitStats.get(b.id)!;
        return (sb.rate ?? 0) - (sa.rate ?? 0);
      })[0];
      return `Your habits are all solid right now. If you want to get more from the plan, pick the one you care most about — "${best?.title ?? habits[0].title}" is your strongest — and try progressing it. Reply "progress" and I’ll show you how.`;
    }

    // ── 21. How can I improve / do better ─────────────────────────────────
    if (/improve|do better|get better|be more consistent|more consistent|level up|optimize|fix my|what.s wrong|what am i doing wrong/.test(msg)) {
      const worst = habits.reduce<typeof habits[0] | undefined>((w, h) => {
        const s = habitStats.get(h.id)!;
        const ws = w ? habitStats.get(w.id)! : null;
        if (s.rate === null) return w;
        return !ws || s.rate < (ws.rate ?? 1) ? h : w;
      }, undefined);
      if (worst && habitStats.get(worst.id)!.rate !== null) {
        const s = habitStats.get(worst.id)!;
        const tip = s.rate! < 0.4
          ? `Drop it to micro — ${worst.fallback_habit ?? "2-min version"} — for 5 days to rebuild the reflex.`
          : s.rate! < 0.65
          ? `Try shifting it to a different time slot. Low completion often means the window is wrong, not the habit.`
          : `The gap is small — just stay consistent for another week.`;
        return `Biggest lever: "${worst.title}" at ${Math.round(s.rate! * 100)}%. ${tip}`;
      }
      return `Consistency is the main lever. Log every session — even skips. The data tells me where to adjust. What habit feels hardest right now?`;
    }

    // ── 22. What’s working / going well ───────────────────────────────────
    if (/what.s (working|going well|good)|what (is|are) (good|strong|working)|doing well|my best/.test(msg)) {
      const strong = habits.filter((h) => {
        const s = habitStats.get(h.id);
        return s?.rate !== null && s!.rate >= 0.75;
      });
      if (strong.length > 0) {
        const lines = strong.map((h) => `"${h.title}" (${Math.round(habitStats.get(h.id)!.rate! * 100)}%)`).join(", ");
        return `Strong habits: ${lines}. These are your anchors — don’t change what’s working. The question is whether to progress any of them or use that momentum to fix the weaker ones.`;
      }
      return `You’re still building momentum — not enough data yet to call anything a strong habit. Keep logging for a week and I’ll have a clearer picture.`;
    }

    // ── 23. What’s not working / struggling ───────────────────────────────
    if (/what.s not (working|sticking)|struggling|hard(est)?|difficult|not sticking|problem|issue|why (can.t|don.t|am i not)/.test(msg)) {
      const struggling = habits.filter((h) => {
        const s = habitStats.get(h.id);
        return s?.rate !== null && s!.rate < 0.6;
      });
      if (struggling.length > 0) {
        const h = struggling[0];
        const s = habitStats.get(h.id)!;
        return `"${h.title}" is struggling at ${Math.round(s.rate! * 100)}%. Most common reasons: wrong time slot, duration too long, or too much going on that day. Which of those fits?`;
      }
      return `Nothing looks broken from the data. If something feels hard, tell me which habit — I’ll look at the pattern.`;
    }

    // ── 24. Fallback — rotates to avoid exact repeats ─────────────────────
    const alreadyGaveStats = lastCoachMsg.includes("% completion over the last") || lastCoachMsg.includes("Last 14 days");
    const alreadyAskedFocus = lastCoachMsg.includes("What would you like to work on") || lastCoachMsg.includes("Ask me");
    const msgCount = input.history.filter((m) => m.role === "assistant").length;

    if (!alreadyGaveStats && overallRate !== null) {
      const lowestHabit = habits.reduce<typeof habits[0] | undefined>((worst, h) => {
        const s = habitStats.get(h.id)!;
        const wS = worst ? habitStats.get(worst.id)! : null;
        if (s.rate === null || s.rate >= 0.7) return worst;
        return !wS || s.rate < (wS.rate ?? 1) ? h : worst;
      }, undefined);
      const frictionLine = lowestHabit
        ? `Biggest friction: "${lowestHabit.title}" (${Math.round(habitStats.get(lowestHabit.id)!.rate! * 100)}%). `
        : overallRate >= 90 ? `All habits looking strong. ` : "";
      return `You’re at ${overallRate}% completion over the last 14 days. ${frictionLine}What would you like to work on — a specific habit, today’s schedule, or something else?`;
    }

    if (!alreadyAskedFocus) {
      const habitNames = habits.slice(0, 3).map((h) => `"${h.title}"`).join(", ");
      return `I can help with ${habitNames}${habits.length > 3 ? " and more" : ""}. Ask me: what to do today, why something isn’t sticking, whether you’re ready to progress, or ask me to add a new habit.`;
    }

    // True last-resort: vary by message count so it never repeats exactly
    const lastResorts = [
      `Try asking: "what should I focus on?" or "what’s not working?" — I’ll give you a specific answer based on your data.`,
      `Tell me which habit is giving you trouble and I’ll dig into it.`,
      `Not sure what you’re looking for — are you checking in, trying to add something, or want to adjust your plan?`,
      `I work best with specific questions. Which habit are you thinking about right now?`,
    ];
    return lastResorts[msgCount % lastResorts.length];
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

function habitAction(msg: string, preferredTime: TimeOfDay): string {
  const g = msg.toLowerCase();
  let habit: GeneratedHabit;

  if (/meditat|mindful|breath|calm|stress|anxiet/.test(g)) {
    habit = {
      title: "5-min meditation",
      purpose: "Anchor focus and reduce stress daily.",
      category: "mind",
      frequency: "daily",
      preferred_time: preferredTime,
      duration_minutes: 5,
      difficulty: "micro",
      fallback_habit: "10 slow breaths, eyes closed.",
    };
  } else if (/gym|workout|exercise|lift|strength|cardio|run|jog/.test(g)) {
    habit = {
      title: "Workout session",
      purpose: "Build consistent fitness momentum.",
      category: "movement",
      frequency: "3x_week",
      preferred_time: preferredTime,
      duration_minutes: 30,
      difficulty: "medium",
      fallback_habit: "10 squats + 10 push-ups anywhere.",
    };
  } else if (/walk|step|move|active/.test(g)) {
    habit = {
      title: "Daily walk",
      purpose: "Build baseline movement every day.",
      category: "movement",
      frequency: "daily",
      preferred_time: preferredTime,
      duration_minutes: 20,
      difficulty: "easy",
      fallback_habit: "Walk to the end of the street and back.",
    };
  } else if (/read|book|learn|study/.test(g)) {
    habit = {
      title: "Read 10 pages",
      purpose: "Daily learning momentum.",
      category: "learning",
      frequency: "daily",
      preferred_time: "evening",
      duration_minutes: 15,
      difficulty: "easy",
      fallback_habit: "Read one page.",
    };
  } else if (/sleep|bed|wind.?down|rest/.test(g)) {
    habit = {
      title: "Wind-down routine",
      purpose: "Protect a consistent sleep window.",
      category: "sleep",
      frequency: "daily",
      preferred_time: "night",
      duration_minutes: 10,
      difficulty: "easy",
      fallback_habit: "Phone out of bedroom 10 min earlier.",
    };
  } else if (/water|hydrat|drink/.test(g)) {
    habit = {
      title: "3 water breaks",
      purpose: "Stay hydrated throughout the day.",
      category: "nutrition",
      frequency: "daily",
      preferred_time: "morning",
      duration_minutes: 2,
      difficulty: "micro",
      fallback_habit: "One glass at lunch.",
    };
  } else if (/journal|write|reflect|diary/.test(g)) {
    habit = {
      title: "3-line journal",
      purpose: "Daily reflection for clarity.",
      category: "mind",
      frequency: "daily",
      preferred_time: "evening",
      duration_minutes: 5,
      difficulty: "easy",
      fallback_habit: "One sentence: 'Today I…'",
    };
  } else if (/phone|screen|social|notif|distract/.test(g)) {
    habit = {
      title: "Phone-free first 30 min",
      purpose: "Protect morning focus.",
      category: "productivity",
      frequency: "daily",
      preferred_time: "morning",
      duration_minutes: 30,
      difficulty: "medium",
      fallback_habit: "Phone face-down for 10 minutes.",
    };
  } else if (/stretch|yoga|flexib|mobili/.test(g)) {
    habit = {
      title: "Morning stretch",
      purpose: "Improve mobility and reduce stiffness.",
      category: "movement",
      frequency: "daily",
      preferred_time: "morning",
      duration_minutes: 10,
      difficulty: "easy",
      fallback_habit: "3 neck rolls + 3 shoulder circles.",
    };
  } else if (/eat|meal|nutrition|diet|cook|food/.test(g)) {
    habit = {
      title: "Mindful eating",
      purpose: "Build a healthier relationship with food.",
      category: "nutrition",
      frequency: "daily",
      preferred_time: "midday",
      duration_minutes: 5,
      difficulty: "easy",
      fallback_habit: "Sit down to eat — no screens.",
    };
  } else if (/break|sit(ting)?|desk|pomodoro|every\s*\d+\s*min|screen break|eye|rest.*work|work.*rest/.test(g)) {
    const mins = g.match(/(\d+)\s*min/)?.[1];
    const interval = mins ? `every ${mins} minutes` : "every 20 minutes";
    habit = {
      title: `Desk break ${interval}`,
      purpose: "Prevent eye strain and posture fatigue by stepping away from the screen regularly. Improves focus and reduces physical tension from long sitting sessions.",
      category: "health",
      frequency: "daily",
      preferred_time: "any",
      duration_minutes: 5,
      difficulty: "easy",
      fallback_habit: "Stand up, roll your shoulders, look 20 feet away for 20 seconds.",
    };
  } else {
    // Generic: extract only the text AFTER the trigger word to avoid including
    // preamble like "I am feeling low today, due to work, add a routine that..."
    const afterTrigger = g.match(
      /(?:add|track|create|start|i want to (?:add|track|start)|new habit for)\s+(?:a\s+)?(?:routine|habit|practice\s+)?(?:that\s+|where\s+|to\s+)?(.*)/
    )?.[1] ?? g.replace(/\b(add|track|i want to|can you|could you|create|new habit for|start|i'd like to|please|a routine that|a habit that)\b/g, "").trim();

    // Clean up and title-case
    const intent = afterTrigger.replace(/\s+/g, " ").trim().slice(0, 60);
    const title = intent.charAt(0).toUpperCase() + intent.slice(1);
    habit = {
      title: title || "New habit",
      purpose: `Build consistency around: ${intent}. Start small — a daily 2-minute version is enough to form the pattern first.`,
      category: "other",
      frequency: "daily",
      preferred_time: preferredTime,
      duration_minutes: 10,
      difficulty: "easy",
      fallback_habit: "Do the 2-minute version.",
    };
  }

  const tag = `[HABIT_ACTION:${JSON.stringify(habit)}]`;
  return `Here's "${habit.title}" — ${habit.duration_minutes} min, ${habit.preferred_time.replace(/_/g, " ")}, ${habit.difficulty} difficulty. Fallback on tough days: ${habit.fallback_habit}${tag}`;
}

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
