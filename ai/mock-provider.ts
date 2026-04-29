import type { AIProvider } from "./provider";
import type {
  Adaptation,
  GeneratedHabit,
  GeneratedPlan,
  Habit,
  HabitLog,
  OnboardingResponse,
  TimeOfDay,
} from "@/types";

// Fallback provider — used when no real API key is configured.
// Uses the same computed analytics the LLM system prompt gets
// (skip streaks, mood correlation, best time windows) so the
// experience degrades gracefully rather than giving generic text.

export class MockProvider implements AIProvider {
  name = "mock";

  async generatePlan({ onboarding: o }: { onboarding: OnboardingResponse }): Promise<GeneratedPlan> {
    const habits: GeneratedHabit[] = [];
    let used = 0;
    const firstTime: TimeOfDay = o.preferred_times[0] ?? "morning";
    const secondTime: TimeOfDay = o.preferred_times[1] ?? "evening";
    const lowEnergy = o.energy_level === "low" || o.energy_level === "variable";

    const pushIfFits = (h: GeneratedHabit) => {
      if (used + h.duration_minutes <= o.availability_min && habits.length < 6) {
        habits.push(h);
        used += h.duration_minutes;
      }
    };

    for (const goal of o.goals.slice(0, 5)) {
      pushIfFits(goalHabit(goal, { lowEnergy, firstTime, secondTime }));
    }

    if (!habits.find((h) => h.category === "sleep") && /sleep|rest/i.test(o.goals.join(" "))) {
      pushIfFits({ title: "Lights-out anchor", purpose: "Consistent sleep window — biggest lever for energy.", category: "sleep", frequency: "daily", preferred_time: "night", duration_minutes: 2, difficulty: "micro", fallback_habit: "Dim main lights 10 min earlier." });
    }
    if (lowEnergy && !habits.find((h) => /water|hydrat/i.test(h.title))) {
      pushIfFits({ title: "Glass of water on wake", purpose: "Reduce mid-morning fatigue.", category: "nutrition", frequency: "daily", preferred_time: "early_morning", duration_minutes: 1, difficulty: "micro", fallback_habit: "Half a glass is still a win." });
    }

    return {
      rationale: `Plan tuned for a ${o.life_mode.replace(/_/g, " ")} with ${o.energy_level} energy and ${o.availability_min} min/day. Prioritised: ${o.goals.slice(0, 3).join(", ")}. Every habit has a fallback so bad days still count.`,
      habits,
    };
  }

  async coachReply(input: Parameters<AIProvider["coachReply"]>[0]): Promise<string> {
    const raw = input.userMessage;
    const msg = raw.toLowerCase().trim();
    const { activeHabits: habits, recentLogs: logs, mood, blocker, onboarding, history } = input;

    if (habits.length === 0) {
      return `You don't have any active habits yet. Go to the Dashboard and click "+ New Habit", or ask me to add one right here — just tell me what you want to track.`;
    }

    // ── Compute analytics once ────────────────────────────────────────────
    const today = new Date().toISOString().slice(0, 10);
    const todayLogs = logs.filter((l) => l.completion_date === today);
    const stats = computeStats(habits, logs);
    const best = bestWindow(habits, logs);
    const moodCorr = moodCorrelation(logs);
    const lastAssistant = [...history].reverse().find((m) => m.role === "assistant")?.content ?? "";
    const msgCount = history.filter((m) => m.role === "assistant").length;
    const firstName = input.profileContext.first_name?.trim();

    // ── Today's status ────────────────────────────────────────────────────
    const orderedToday = sortByTime(habits);
    const notLoggedToday = orderedToday.filter(
      (h) => !todayLogs.find((l) => l.habit_id === h.id && l.status === "completed")
    );
    const completedToday = orderedToday.filter(
      (h) => !!todayLogs.find((l) => l.habit_id === h.id && l.status === "completed")
    );

    // ── Greeting ──────────────────────────────────────────────────────────
    if (/^(hi|hello|hey|good (morning|afternoon|evening)|howdy|sup)[!.?]*$/.test(msg)) {
      const s = stats.overall;
      const rateNote = s.rate !== null ? `You're at ${Math.round(s.rate * 100)}% overall over the last 14 days.` : "No logs yet — today's a great day to start.";
      const hey = firstName ? `Hey ${firstName}! ` : `Hey! `;
      return `${hey}${rateNote} ${completedToday.length}/${habits.length} done today. What do you need?`;
    }

    // ── Low mood from mood picker ─────────────────────────────────────────
    if (mood !== undefined && mood <= 2) {
      const lines = habits.slice(0, 5).map((h) => `• "${h.title}" → ${h.fallback_habit ?? "2-min version"}`);
      const moodNote = moodCorr ? ` Data: you tend to skip when mood ≤ ${moodCorr.threshold}/5 — today fits that.` : "";
      return `Rough day — fallback mode only:${moodNote}\n${lines.join("\n")}\n\nOne rep per habit still counts. Reset tomorrow.`;
    }
    if (mood !== undefined && mood >= 4) {
      const progressable = habits.find((h) => (stats.byHabit.get(h.id)?.rate ?? 0) >= 0.8 && h.difficulty !== "hard");
      return progressable
        ? `Good energy — push hard. "${progressable.title}" is at ${pct(stats.byHabit.get(progressable.id)!.rate!)}, perfect time to extend it. ${best ? `Your strongest slot is ${best.window.replace(/_/g, " ")} (${pct(best.rate)}).` : ""}`
        : `High energy. Do every habit in full — no fallbacks today. ${stats.overall.rate !== null ? `You're at ${pct(stats.overall.rate)} overall.` : ""}`;
    }

    // ── Add a habit (must come before edit check) ─────────────────────────
    const isAddIntent = /\b(add|track|create|new habit)\b/i.test(msg)
      || /i want to (add|start|track)/i.test(msg)
      || /add a (habit|routine|practice)/i.test(msg);

    if (isAddIntent) {
      const preferredTime: TimeOfDay = onboarding?.preferred_times?.[0] ?? "morning";
      return buildHabitAction(msg, preferredTime);
    }

    // ── Edit existing habit (change/update/make X shorter/longer/to Y) ──────
    const editIntent = /\b(change|update|edit|modify|set|make)\b.*(habit|workout|walk|run|gym|session|meditation|draw|journal|stretch|breath|water|sleep|reading)/i.test(msg)
      || /\b(change|update|edit|set|make)\b.*\b(to|at|shorter|longer|faster|earlier|later|\d+\s*min)\b/i.test(msg)
      || /\b(make|set)\b.*(shorter|longer|earlier|later)/.test(msg)
      || /\b\d+\s*min(utes?)?\s*(instead|a day)\b/.test(msg);

    if (editIntent) {
      // Find the habit being referenced
      const STOP_WORDS = new Set(["habit", "every", "minutes", "daily", "session", "break", "walk", "more", "that", "with", "this", "instead", "shorter", "longer"]);
      const editTarget = habits.find((h) => {
        const title = h.title.toLowerCase();
        if (msg.includes(title)) return true;
        return title.split(/\s+/).some((w) => w.length > 3 && !STOP_WORDS.has(w) && msg.includes(w));
      });

      if (editTarget) {
        // Parse new duration
        const newMins = msg.match(/(\d+)\s*min/)?.[1];
        // Parse new time
        const newTime = parseTimeFromMsg(msg);
        // Parse new frequency
        const newFreq = /3x|three times|mon.*wed.*fri/.test(msg) ? "3x_week"
          : /daily|every day/.test(msg) ? "daily"
          : /weekday/.test(msg) ? "weekdays" : undefined;

        const patch: Record<string, unknown> = {};
        if (newMins) patch.duration_minutes = parseInt(newMins, 10);
        if (newTime && newTime !== editTarget.preferred_time) patch.preferred_time = newTime;
        if (newFreq && newFreq !== editTarget.frequency) patch.frequency = newFreq;

        if (Object.keys(patch).length === 0) {
          return `"${editTarget.title}" is currently ${editTarget.duration_minutes} min, ${editTarget.preferred_time.replace(/_/g, " ")}, ${editTarget.frequency}. What would you like to change — duration, time, or frequency?`;
        }

        const desc = [
          patch.duration_minutes ? `duration to ${patch.duration_minutes} min` : "",
          patch.preferred_time ? `time to ${String(patch.preferred_time).replace(/_/g, " ")}` : "",
          patch.frequency ? `frequency to ${String(patch.frequency).replace(/_/g, " ")}` : "",
        ].filter(Boolean).join(", ");

        const tag = `[HABIT_EDIT:${JSON.stringify({ habit_id: editTarget.id, title: editTarget.title, description: `Updated ${desc}.`, patch })}]`;
        return `Updated "${editTarget.title}" — ${desc}.${tag}`;
      }
      // No matching habit found
      return `Which habit do you want to change? Your active habits: ${habits.slice(0, 4).map((h) => `"${h.title}"`).join(", ")}${habits.length > 4 ? ` and ${habits.length - 4} more` : ""}.`;
    }

    // ── "Haven't started" / "help me start" / "what to do today" ─────────
    if (/haven.t (done|started|logged)|not done|no activity|help me start|what (should|do) i (do|start)|where (do|should) i start|what to do|get started|what.s (first|next) today/.test(msg)) {
      if (notLoggedToday.length === 0) {
        return `Everything logged for today — ${habits.length}/${habits.length} done. Nice work. Come back tomorrow or ask me to add a bonus habit.`;
      }
      const first = notLoggedToday[0];
      const rest = notLoggedToday.slice(1, 3);
      return `Start with "${first.title}" — ${first.duration_minutes} min, ${first.preferred_time.replace(/_/g, " ")}.${rest.length ? ` After: ${rest.map((h) => `"${h.title}"`).join(", ")}.` : ""}`;
    }

    // ── "Completed X, what's next" ────────────────────────────────────────
    if (/complet|done with|finished|just did|logged|what.?s next|what (should|do) i do next/.test(msg)) {
      if (notLoggedToday.length === 0) {
        return `All habits logged today — ${completedToday.length}/${habits.length} done. You're finished for the day.`;
      }
      const next = notLoggedToday[0];
      return `Next up: "${next.title}" — ${next.duration_minutes} min, ${next.preferred_time.replace(/_/g, " ")}, ${next.difficulty}.`;
    }

    // ── Busy / no time ────────────────────────────────────────────────────
    if (/no time|too busy|packed|overwhelm/.test(msg)) {
      const micro = notLoggedToday[0] ?? habits[0];
      return `Busy day — do 2 minutes of "${micro?.title ?? "your top habit"}" to protect the streak.`;
    }

    // ── Tired / sore / low energy ─────────────────────────────────────────
    if (/tired|exhaust|drained|no energy|bad sleep|sore|ache/.test(msg)) {
      const isPhysical = /sore|ache|muscle/.test(msg);
      const movementH = habits.find((h) => h.category === "movement");
      if (isPhysical && movementH) {
        const rest = habits.filter((h) => h.id !== movementH.id).slice(0, 3).map((h) => `• "${h.title}"`).join("\n");
        return `Physical fatigue = recovery day. Skip "${movementH.title}". Everything else:\n${rest}`;
      }
      const lines = habits.slice(0, 4).map((h) => `• "${h.title}" — ${h.duration_minutes > 5 ? "shortened version" : "as-is"}`);
      const whyNote = moodCorr ? ` Data shows you skip more when mood ≤ ${moodCorr.threshold}/5 — today fits that pattern.` : "";
      return `Low-energy day — lighter versions only:${whyNote}\n${lines.join("\n")}`;
    }

    // ── Missed / skipped / streak broken ─────────────────────────────────
    if (/miss|skip|slip|streak|forgot|didn.t do|fell off|behind/.test(msg)) {
      const worstH = worstHabit(habits, stats.byHabit);
      const skipStreak = worstH ? recentSkipStreak(worstH.id, logs) : 0;
      const whyLine = moodCorr
        ? `Data pattern: you skip at avg mood ${moodCorr.skipMoodAvg.toFixed(1)}/5 vs complete at ${moodCorr.completeMoodAvg.toFixed(1)}/5 — that's the signal.`
        : `Missing is data, not failure.`;

      if (skipStreak >= 4 && worstH?.frequency === "daily") {
        return `${whyLine}\n\n"${worstH.title}" has been skipped ${skipStreak} days running. Reset: switch to Mon/Wed/Fri for 2 weeks. Dashboard → habit → Edit → Frequency.`;
      }
      if (skipStreak >= 2 && worstH) {
        return `${whyLine}\n\n"${worstH.title}" skipped ${skipStreak} in a row. Stepwise rebuild:\n${stepwisePlan(worstH)}`;
      }
      const bestSlot = best && worstH && best.window !== worstH.preferred_time
        ? ` Shifting "${worstH.title}" to your ${best.window.replace(/_/g, " ")} slot (${pct(best.rate)} success) could fix this.`
        : "";
      return `${whyLine}${bestSlot ? "\n\n" + bestSlot : ""}\n\nFallback for today: ${worstH?.fallback_habit ?? "2-min version of your top habit"}.`;
    }

    // ── Plan me / help me plan / coach me ─────────────────────────────────
    if (/\b(plan|coach me|help me plan|my plan|plan my|schedule|routine)\b/.test(msg)) {
      const ordered = sortByTime(habits);
      const lines = ordered.map((h) => {
        const s = stats.byHabit.get(h.id);
        const rateStr = s?.rate !== null ? ` (${pct(s!.rate!)})` : "";
        return `• ${h.preferred_time.replace(/_/g, " ")}: "${h.title}" — ${h.duration_minutes}m, ${h.difficulty}${rateStr}`;
      });
      const bestNote = best ? `\n\nStrongest slot: ${best.window.replace(/_/g, " ")} at ${pct(best.rate)} — schedule your priority habits there.` : "";
      return `Your current plan (${habits.length} habits):\n${lines.join("\n")}${bestNote}\n\nWhat would you like to adjust?`;
    }

    // ── Motivation / stuck ────────────────────────────────────────────────
    if (/motivat|procrastinat|can.t start|don.t want|stuck|meh|lazy|resistance/.test(msg)) {
      const first = notLoggedToday[0] ?? habits[0];
      return `Start with the fallback: ${first?.fallback_habit ?? "2 minutes of your top habit"}. Motivation follows action. Text me back when it's done.`;
    }

    // ── Stats / overview ──────────────────────────────────────────────────
    if (/\b(stat|how am i|overview|summary|progress|how.*(week|fortnight))\b/.test(msg)) {
      const lines = habits.map((h) => {
        const s = stats.byHabit.get(h.id)!;
        return `• "${h.title}": ${s.rate !== null ? pct(s.rate) : "no logs"}`;
      });
      return `Last 14 days — ${stats.overall.done} done, ${stats.overall.skipped} skipped${stats.overall.rate !== null ? ` (${pct(stats.overall.rate)} overall)` : ""}.\n${lines.join("\n")}${best ? `\n\nStrongest slot: ${best.window.replace(/_/g, " ")} (${pct(best.rate)}).` : ""}`;
    }

    // ── What's not working / struggling ──────────────────────────────────
    if (/not (working|sticking)|struggling|hard(est)?|what.s wrong|why (can.t|don.t|am i)/.test(msg)) {
      const weakH = worstHabit(habits, stats.byHabit);
      if (!weakH || stats.byHabit.get(weakH.id)!.rate === null) {
        return `Not enough data yet — log a few sessions and I'll tell you exactly where the friction is.`;
      }
      const s = stats.byHabit.get(weakH.id)!;
      const streak = recentSkipStreak(weakH.id, logs);
      const whyParts: string[] = [];
      if (moodCorr) whyParts.push(`mood dips (you skip at avg ${moodCorr.skipMoodAvg.toFixed(1)}/5)`);
      if (best && best.window !== weakH.preferred_time) whyParts.push(`time slot mismatch (${best.window.replace(/_/g, " ")} is your ${pct(best.rate)} window)`);
      if (streak >= 3) whyParts.push(`${streak}-day skip streak`);
      const whyStr = whyParts.length ? `Why: ${whyParts.join("; ")}.` : "Most common cause: duration too long or wrong time slot.";
      return `"${weakH.title}" at ${pct(s.rate!)} is the friction point. ${whyStr}\n\nFix:\n${stepwisePlan(weakH)}`;
    }

    // ── How to improve / do better ────────────────────────────────────────
    if (/improve|do better|be more consistent|level up|optimize|get better/.test(msg)) {
      const weakH = worstHabit(habits, stats.byHabit);
      if (!weakH || stats.byHabit.get(weakH.id)!.rate === null) {
        return `Keep logging — even skips. Once I have 5+ entries per habit, I can pinpoint exactly what to change.`;
      }
      const s = stats.byHabit.get(weakH.id)!;
      const bestSlotNote = best && best.window !== weakH.preferred_time
        ? `\n\nAlso: move "${weakH.title}" to ${best.window.replace(/_/g, " ")} — your ${pct(best.rate)} success window.`
        : "";
      const moodNote = moodCorr
        ? ` Mood pattern: complete at avg ${moodCorr.completeMoodAvg.toFixed(1)}/5, skip at ${moodCorr.skipMoodAvg.toFixed(1)}/5 — use fallbacks on low-mood days.`
        : "";
      return `Biggest lever: "${weakH.title}" at ${pct(s.rate!)}.${moodNote}\n\n${stepwisePlan(weakH)}${bestSlotNote}`;
    }

    // ── Progression / ready to step up ───────────────────────────────────
    if (/progress|next level|step up|challeng|make.*harder|increase/.test(msg)) {
      const ready = habits.find((h) => (stats.byHabit.get(h.id)?.rate ?? 0) >= 0.75 && h.difficulty !== "hard");
      if (ready) {
        const s = stats.byHabit.get(ready.id)!;
        return `"${ready.title}" is at ${pct(s.rate!)} — ready. Add ~${Math.round(ready.duration_minutes * 0.3)} min and bump difficulty one step. Dashboard → habit → Edit. Reply "yes" to confirm.`;
      }
      return `Not yet — aim for 75%+ on a habit before stepping up. ${stats.overall.rate !== null ? `You're at ${pct(stats.overall.rate)} overall.` : "Keep logging for a cleaner read."}`;
    }

    // ── Confirmation ("yes", "go ahead") ─────────────────────────────────
    if (/^(yes|yeah|sure|ok|okay|apply|do it|go ahead|let.?s do it|sounds good)[!.?]*$/.test(msg)) {
      if (/bump|progress|duration|step up|harder/.test(lastAssistant)) {
        const readyH = habits.find((h) => (stats.byHabit.get(h.id)?.rate ?? 0) >= 0.75) ?? habits[0];
        return `Dashboard → tap "${readyH?.title ?? "the habit"}" → Edit → increase duration by ~30% and bump difficulty one level.`;
      }
      if (/shift|time|slot|window|earlier|later|move/.test(lastAssistant)) {
        return `Dashboard → tap the habit → Edit → change Preferred Time. Give it a week and log every attempt.`;
      }
      if (/frequency|mon.*wed.*fri|3x/.test(lastAssistant)) {
        return `Dashboard → tap the habit → Edit → set Frequency to "3× per week". Re-evaluate after 2 weeks.`;
      }
      return `Dashboard → tap the relevant habit → Edit to apply the change. Log your first attempt after — that's the data I need.`;
    }

    // ── Acknowledgements ─────────────────────────────────────────────────
    if (/^(thanks|thank you|thx|ty|great|perfect|awesome|got it|makes sense|helpful)[!.?]*$/i.test(msg)) {
      const weakH = worstHabit(habits, stats.byHabit);
      return weakH && (stats.byHabit.get(weakH.id)?.rate ?? 1) < 0.6
        ? `Anytime. One thing to keep an eye on: "${weakH.title}" is at ${pct(stats.byHabit.get(weakH.id)!.rate!)} — that's the next thing to work on.`
        : `Anytime. Keep logging — the data gets sharper with every entry.`;
    }

    // ── List habits ───────────────────────────────────────────────────────
    if (/list|show|what (are|is) my habit|how many habit/.test(msg)) {
      const lines = habits.map((h) => {
        const s = stats.byHabit.get(h.id)!;
        return `• "${h.title}" — ${h.duration_minutes}m, ${h.preferred_time.replace(/_/g, " ")}, ${h.difficulty} (${s.rate !== null ? pct(s.rate) : "no logs"})`;
      });
      return `${habits.length} active habit${habits.length !== 1 ? "s" : ""}:\n${lines.join("\n")}`;
    }

    // ── Specific habit mentioned ──────────────────────────────────────────
    const HABIT_STOP_WORDS = new Set(["habit", "every", "minutes", "daily", "session", "break", "more", "that", "with", "this", "instead", "shorter", "longer", "faster"]);
    const namedHabit = habits.find((h) => {
      const title = h.title.toLowerCase();
      if (msg.includes(title)) return true;
      return title.split(/\s+/).some((w) => w.length > 3 && !HABIT_STOP_WORDS.has(w) && msg.includes(w));
    });
    if (namedHabit) {
      const s = stats.byHabit.get(namedHabit.id)!;
      const skipStreak = recentSkipStreak(namedHabit.id, logs);
      const rateStr = s.rate !== null ? pct(s.rate) : "no logs yet";

      if (/when|time|schedul|best time/.test(msg)) {
        const bestNote = best && best.window !== namedHabit.preferred_time
          ? ` Your highest-success window is ${best.window.replace(/_/g, " ")} (${pct(best.rate)}) — moving it there could help.`
          : "";
        return s.rate !== null && s.rate < 0.5
          ? `"${namedHabit.title}" is at ${rateStr} in the ${namedHabit.preferred_time.replace(/_/g, " ")} slot — that window isn't working.${bestNote} Want to shift it?`
          : `"${namedHabit.title}" at ${rateStr} in ${namedHabit.preferred_time.replace(/_/g, " ")}.${bestNote}`;
      }
      if (/stat|complet|rate|how.*doing|progress/.test(msg)) {
        const streakNote = skipStreak >= 2 ? ` (${skipStreak}-day skip streak)` : "";
        return `"${namedHabit.title}": ${s.done} done, ${s.skipped} skipped — ${rateStr}${streakNote}.`;
      }
      if (/improve|fix|help|consistent|better/.test(msg)) {
        if (s.rate === null) return `No logs yet for "${namedHabit.title}". Log it today — even the fallback counts.`;
        if (s.rate < 0.5) return `"${namedHabit.title}" at ${rateStr}${skipStreak >= 2 ? ` (${skipStreak}-day streak)` : ""}.\n\n${stepwisePlan(namedHabit)}`;
        return `"${namedHabit.title}" at ${rateStr} — nearly there. ${best && best.window !== namedHabit.preferred_time ? `Shift to ${best.window.replace(/_/g, " ")} (${pct(best.rate)}) to close the gap.` : "Try habit stacking — pair it with something you already do."}`;
      }
      return `"${namedHabit.title}" — ${namedHabit.duration_minutes}m, ${namedHabit.preferred_time.replace(/_/g, " ")}, ${namedHabit.difficulty}${rateStr !== "no logs yet" ? `, ${rateStr}` : ""}. On tough days: ${namedHabit.fallback_habit ?? "2-min version"}.`;
    }

    // ── Goals ─────────────────────────────────────────────────────────────
    if (/\b(goal|aim|target|trying to|purpose|why)\b/.test(msg)) {
      const goals = onboarding?.goals ?? [];
      return goals.length
        ? `Your goals: ${goals.join("; ")}. Each active habit maps to one of them. Is there a goal that feels un-served by the current plan?`
        : `No goals set yet. Go through onboarding (Settings) and I'll tie every habit to a specific goal.`;
    }

    // ── Blocker context from UI ───────────────────────────────────────────
    if (blocker) {
      const first = notLoggedToday[0] ?? habits[0];
      return `Blocker: "${blocker}". Swap "${first?.title ?? "your top habit"}" for its fallback today: ${first?.fallback_habit ?? "2-min version"}. What would need to change to remove that blocker tomorrow?`;
    }

    // ── Fallback — never repeat exact last message ────────────────────────
    const fallbacks = [
      notLoggedToday.length > 0
        ? `${completedToday.length} done so far today, ${notLoggedToday.length} left. Next: "${notLoggedToday[0].title}" — ${notLoggedToday[0].duration_minutes} min. Anything specific you want help with?`
        : `All habits logged for today. Ask me about a specific habit, your stats, or what to adjust.`,
      `I can help with: today's order, why something isn't sticking, whether you're ready to progress, or adding a new habit. Which?`,
      `Tell me which habit you're thinking about and I'll give you specific data from your logs.`,
      `Try asking: "what should I focus on?" or "what's not working?" — I'll pull the answer from your data.`,
    ];
    // Rotate to avoid repeating the same fallback if the previous was the same
    const pick = fallbacks.find((f) => !lastAssistant.startsWith(f.slice(0, 40))) ?? fallbacks[msgCount % fallbacks.length];
    return pick;
  }

  async adapt({ habits, logs }: { habits: Habit[]; logs: HabitLog[]; onboarding: OnboardingResponse | null }): Promise<Adaptation[]> {
    const adaptations: Adaptation[] = [];
    for (const h of habits) {
      const hLogs = logs.filter((l) => l.habit_id === h.id);
      const done = hLogs.filter((l) => l.status === "completed").length;
      const skipped = hLogs.filter((l) => l.status === "skipped").length;
      const total = done + skipped;
      if (total < 3) continue;
      const rate = done / total;

      if (rate < 0.4 && h.difficulty !== "micro") {
        adaptations.push({ habit_id: h.id, kind: "simpler_version", reason: `Only ${Math.round(rate * 100)}% completion over ${total} attempts.`, suggestion: `Reduce "${h.title}" to its micro version: ${h.fallback_habit ?? "2-min version"}.`, patch: { difficulty: h.difficulty === "hard" ? "easy" : "micro", duration_minutes: Math.max(2, Math.round(h.duration_minutes / 2)) } });
      } else if (rate < 0.5 && h.frequency === "daily") {
        adaptations.push({ habit_id: h.id, kind: "reduced_frequency", reason: "Daily cadence isn't landing — consistency beats intensity.", suggestion: `Drop "${h.title}" to 3×/week for a cleaner win-rate.`, patch: { frequency: "3x_week" } });
      } else if (rate >= 0.85 && h.difficulty !== "hard") {
        adaptations.push({ habit_id: h.id, kind: "progression", reason: `${Math.round(rate * 100)}% completion — ready for the next step.`, suggestion: `Progress "${h.title}" to a harder tier with +${Math.round(h.duration_minutes * 0.3)} min.`, patch: { difficulty: h.difficulty === "micro" ? "easy" : h.difficulty === "easy" ? "medium" : "hard", duration_minutes: Math.round(h.duration_minutes * 1.3) } });
      }
    }
    return adaptations;
  }

  async weeklyInsight({ summary, onboarding }: Parameters<AIProvider["weeklyInsight"]>[0]) {
    const rate = Math.round(summary.completion_rate * 100);
    const best = summary.best_windows[0];
    const worst = summary.most_skipped[0];

    let insight = `You completed ${rate}% of scheduled habits this week`;
    if (best) insight += `, strongest in the ${best.window.replace("_", " ")} window`;
    insight += ".";
    if (worst) insight += ` "${worst.title}" was skipped ${worst.count}× — biggest friction point.`;
    if (summary.mood_avg != null) insight += ` Mood averaged ${summary.mood_avg.toFixed(1)}/5.`;
    if (summary.top_blockers.length) insight += ` Common blocker: "${summary.top_blockers[0]}".`;

    let next_step = rate < 50 && worst
      ? `Shrink "${worst.title}" to its 2-minute fallback for 7 days. Win-rate first, volume later.`
      : rate >= 80
        ? `Pick ONE habit to progress — raise duration ~30%. Keep the rest unchanged.`
        : `Move your weakest habit into the ${best?.window.replace("_", " ") ?? "morning"} window where your completion is highest.`;
    if (onboarding?.energy_level === "low") next_step += " Keep intensity capped — you're playing a long game.";

    return { insight, next_step };
  }
}

// ── Analytics helpers ────────────────────────────────────────────────────────

function computeStats(habits: Habit[], logs: HabitLog[]) {
  const byHabit = new Map<string, { done: number; skipped: number; rate: number | null }>();
  let totalDone = 0, totalSkipped = 0;
  for (const h of habits) {
    const hLogs = logs.filter((l) => l.habit_id === h.id);
    const done = hLogs.filter((l) => l.status === "completed").length;
    const skipped = hLogs.filter((l) => l.status === "skipped").length;
    const total = done + skipped;
    totalDone += done; totalSkipped += skipped;
    byHabit.set(h.id, { done, skipped, rate: total > 0 ? done / total : null });
  }
  const total = totalDone + totalSkipped;
  return { byHabit, overall: { done: totalDone, skipped: totalSkipped, rate: total > 0 ? totalDone / total : null } };
}

function worstHabit(habits: Habit[], byHabit: Map<string, { rate: number | null }>): Habit | undefined {
  return habits.reduce<Habit | undefined>((w, h) => {
    const s = byHabit.get(h.id)!;
    const ws = w ? byHabit.get(w.id)! : null;
    if (s.rate === null) return w;
    return !ws || s.rate < (ws.rate ?? 1) ? h : w;
  }, undefined);
}

function bestWindow(habits: Habit[], logs: HabitLog[]): { window: TimeOfDay; rate: number } | null {
  const map = new Map<TimeOfDay, { done: number; total: number }>();
  for (const h of habits) {
    const hLogs = logs.filter((l) => l.habit_id === h.id);
    const done = hLogs.filter((l) => l.status === "completed").length;
    const total = hLogs.filter((l) => l.status === "completed" || l.status === "skipped").length;
    if (total < 2) continue;
    const w = map.get(h.preferred_time) ?? { done: 0, total: 0 };
    w.done += done; w.total += total;
    map.set(h.preferred_time, w);
  }
  const sorted = [...map.entries()].filter(([, v]) => v.total >= 2).sort(([, a], [, b]) => b.done / b.total - a.done / a.total);
  if (!sorted.length) return null;
  const [window, stats] = sorted[0];
  return { window, rate: stats.done / stats.total };
}

function moodCorrelation(logs: HabitLog[]): { threshold: number; skipMoodAvg: number; completeMoodAvg: number } | null {
  const mooded = logs.filter((l) => l.mood !== null);
  if (mooded.length < 5) return null;
  const cMoods = mooded.filter((l) => l.status === "completed").map((l) => l.mood!);
  const sMoods = mooded.filter((l) => l.status === "skipped").map((l) => l.mood!);
  if (cMoods.length < 2 || sMoods.length < 2) return null;
  const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  const cAvg = avg(cMoods), sAvg = avg(sMoods);
  if (cAvg - sAvg < 0.5) return null;
  return { threshold: Math.round(sAvg + 0.5), skipMoodAvg: sAvg, completeMoodAvg: cAvg };
}

function recentSkipStreak(habitId: string, logs: HabitLog[]): number {
  const sorted = logs.filter((l) => l.habit_id === habitId).sort((a, b) => b.completion_date.localeCompare(a.completion_date));
  let streak = 0;
  for (const l of sorted) { if (l.status === "skipped") streak++; else break; }
  return streak;
}

function stepwisePlan(h: Habit): string {
  const p1 = Math.max(2, Math.round(h.duration_minutes * 0.25));
  const p2 = Math.max(5, Math.round(h.duration_minutes * 0.5));
  return `Phase 1 (days 1–7): ${p1} min. Phase 2 (days 8–14): ${p2} min. Phase 3 (day 15+): ${h.duration_minutes} min — full habit.`;
}

function parseTimeFromMsg(msg: string): TimeOfDay | undefined {
  if (/\b(6\s*am|5\s*am|4\s*am|early morning|6am|5am)\b/i.test(msg)) return "early_morning";
  if (/\b(morning|am\b|wake up|breakfast)\b/i.test(msg)) return "morning";
  if (/\b(noon|midday|lunch|12\s*pm)\b/i.test(msg)) return "midday";
  if (/\b(afternoon|2\s*pm|3\s*pm|4\s*pm)\b/i.test(msg)) return "afternoon";
  if (/\b(evening|6\s*pm|7\s*pm|8\s*pm|after work|dinner)\b/i.test(msg)) return "evening";
  if (/\b(night|9\s*pm|10\s*pm|11\s*pm|before bed|bedtime)\b/i.test(msg)) return "night";
  return undefined;
}

function sortByTime(habits: Habit[]): Habit[] {
  const order = ["early_morning", "morning", "midday", "afternoon", "evening", "night", "any"];
  return [...habits].sort((a, b) => order.indexOf(a.preferred_time) - order.indexOf(b.preferred_time));
}

function pct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

// ── Habit creation helper ────────────────────────────────────────────────────

function buildHabitAction(msg: string, preferredTime: TimeOfDay): string {
  const g = msg.toLowerCase();

  // Detect time and duration from the message so we can use them in the habit.
  const detectedTime: TimeOfDay = parseTimeFromMsg(g) ?? preferredTime;
  const detectedMins = g.match(/(\d+)\s*min/)?.[1];

  let habit: GeneratedHabit;

  if (/meditat|mindful|breath|calm|stress|anxiet/.test(g)) {
    habit = { title: "5-min meditation", purpose: "Anchor focus and reduce stress.", category: "mind", frequency: "daily", preferred_time: detectedTime, duration_minutes: detectedMins ? parseInt(detectedMins) : 5, difficulty: "micro", fallback_habit: "10 slow breaths, eyes closed." };
  } else if (/gym|workout|exercise|lift|strength|cardio/.test(g)) {
    habit = { title: "Workout session", purpose: "Build consistent fitness momentum.", category: "movement", frequency: "3x_week", preferred_time: detectedTime, duration_minutes: detectedMins ? parseInt(detectedMins) : 30, difficulty: "medium", fallback_habit: "10 squats + 10 push-ups anywhere." };
  } else if (/danc|zumba|jumba|salsa|ballet/.test(g)) {
    habit = { title: "Dance practice", purpose: "Build a fun, consistent movement habit.", category: "movement", frequency: "daily", preferred_time: detectedTime, duration_minutes: detectedMins ? parseInt(detectedMins) : 15, difficulty: "easy", fallback_habit: "Freestyle move to one song." };
  } else if (/run|jog/.test(g)) {
    habit = { title: "Daily run", purpose: "Build cardio endurance.", category: "movement", frequency: "daily", preferred_time: detectedTime, duration_minutes: detectedMins ? parseInt(detectedMins) : 20, difficulty: "easy", fallback_habit: "Walk for 10 minutes instead." };
  } else if (/walk|step|move/.test(g)) {
    habit = { title: "Daily walk", purpose: "Build baseline movement every day.", category: "movement", frequency: "daily", preferred_time: detectedTime, duration_minutes: detectedMins ? parseInt(detectedMins) : 20, difficulty: "easy", fallback_habit: "Walk to the end of the street and back." };
  } else if (/read|book|learn|study/.test(g)) {
    habit = { title: "Read 10 pages", purpose: "Daily learning momentum.", category: "learning", frequency: "daily", preferred_time: detectedTime !== preferredTime ? detectedTime : "evening", duration_minutes: detectedMins ? parseInt(detectedMins) : 15, difficulty: "easy", fallback_habit: "Read one page." };
  } else if (/sleep|bed|wind.?down/.test(g)) {
    habit = { title: "Wind-down routine", purpose: "Protect a consistent sleep window.", category: "sleep", frequency: "daily", preferred_time: "night", duration_minutes: detectedMins ? parseInt(detectedMins) : 10, difficulty: "easy", fallback_habit: "Phone out of bedroom 10 min earlier." };
  } else if (/water|hydrat|drink/.test(g)) {
    habit = { title: "3 water breaks", purpose: "Stay hydrated throughout the day.", category: "nutrition", frequency: "daily", preferred_time: detectedTime, duration_minutes: 2, difficulty: "micro", fallback_habit: "One glass at lunch." };
  } else if (/journal|write|reflect|diary/.test(g)) {
    habit = { title: "3-line journal", purpose: "Daily reflection for clarity.", category: "mind", frequency: "daily", preferred_time: detectedTime !== preferredTime ? detectedTime : "evening", duration_minutes: detectedMins ? parseInt(detectedMins) : 5, difficulty: "easy", fallback_habit: "One sentence: 'Today I…'" };
  } else if (/stretch|yoga|flexib|mobili/.test(g)) {
    habit = { title: "Morning stretch", purpose: "Improve mobility and reduce stiffness.", category: "movement", frequency: "daily", preferred_time: detectedTime !== preferredTime ? detectedTime : "morning", duration_minutes: detectedMins ? parseInt(detectedMins) : 10, difficulty: "easy", fallback_habit: "3 neck rolls + 3 shoulder circles." };
  } else if (/phone|screen|social|notif/.test(g)) {
    habit = { title: "Phone-free first 30 min", purpose: "Protect morning focus.", category: "productivity", frequency: "daily", preferred_time: detectedTime !== preferredTime ? detectedTime : "morning", duration_minutes: detectedMins ? parseInt(detectedMins) : 30, difficulty: "medium", fallback_habit: "Phone face-down for 10 minutes." };
  } else if (/eat|meal|food|cook|nutrition/.test(g)) {
    habit = { title: "Mindful eating", purpose: "Build a healthier relationship with food.", category: "nutrition", frequency: "daily", preferred_time: detectedTime !== preferredTime ? detectedTime : "midday", duration_minutes: detectedMins ? parseInt(detectedMins) : 5, difficulty: "easy", fallback_habit: "Sit down to eat — no screens." };
  } else if (/break|desk|pomodoro|sit(ting)?|eye|screen break/.test(g)) {
    habit = { title: `Desk break ${detectedMins ? `every ${detectedMins} min` : "every 20 min"}`, purpose: "Prevent eye strain and posture fatigue.", category: "health", frequency: "daily", preferred_time: "any", duration_minutes: 5, difficulty: "easy", fallback_habit: "Stand up, roll shoulders, look 20 feet away for 20 seconds." };
  } else {
    // Extract just the habit name — strip trigger words, time words, and duration.
    // Pattern: "add new habit called X" / "add X" / "track X" etc.
    const calledMatch = g.match(/(?:new\s+)?(?:habit|routine|practice)\s+(?:called|named|for)\s+(.+)/);
    let rawName = calledMatch
      ? calledMatch[1]
      : (g.match(/(?:add|track|create|start)\s+(?:new\s+)?(?:a\s+)?(?:habit\s+)?(.+)/)?.[1] ?? g);
    // Strip duration, time-of-day words, frequency words from the extracted name
    rawName = rawName
      .replace(/\b\d+\s*min(utes?)?\b/g, "")
      .replace(/\b(early morning|morning|midday|afternoon|evening|night|daily|every day|weekday|weekend)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();
    const title = rawName ? rawName.charAt(0).toUpperCase() + rawName.slice(1) : "New habit";
    habit = { title, purpose: `Build a consistent ${title.toLowerCase()} habit.`, category: "other", frequency: "daily", preferred_time: detectedTime, duration_minutes: detectedMins ? parseInt(detectedMins) : 10, difficulty: "easy", fallback_habit: "Do the 2-minute version." };
  }

  const tag = `[HABIT_ACTION:${JSON.stringify(habit)}]`;
  return `Here's "${habit.title}" — ${habit.duration_minutes} min, ${habit.preferred_time.replace(/_/g, " ")}, ${habit.difficulty} difficulty. Fallback: ${habit.fallback_habit}${tag}`;
}

function goalHabit(goal: string, ctx: { lowEnergy: boolean; firstTime: TimeOfDay; secondTime: TimeOfDay }): GeneratedHabit {
  const g = goal.toLowerCase();
  const base = (o: Partial<GeneratedHabit>): GeneratedHabit => ({
    title: o.title ?? "Daily check-in", purpose: o.purpose ?? `Support: ${goal}`, category: o.category ?? "other",
    frequency: o.frequency ?? "daily", preferred_time: o.preferred_time ?? ctx.firstTime,
    duration_minutes: o.duration_minutes ?? 10, difficulty: o.difficulty ?? (ctx.lowEnergy ? "easy" : "medium"),
    fallback_habit: o.fallback_habit ?? "2-min version.",
  });

  if (/sleep|rest/.test(g)) return base({ title: "Wind-down routine", category: "sleep", preferred_time: "night", duration_minutes: 10, difficulty: "easy", fallback_habit: "Phone out of bedroom 10 min earlier." });
  if (/exercise|workout|fit|strong|gym/.test(g)) return base({ title: ctx.lowEnergy ? "15-min mobility walk" : "Strength or cardio", category: "movement", frequency: "3x_week", duration_minutes: ctx.lowEnergy ? 15 : 30, difficulty: ctx.lowEnergy ? "easy" : "medium", fallback_habit: "10 squats + 10 push-ups." });
  if (/read/.test(g)) return base({ title: "Read 10 pages", category: "learning", preferred_time: ctx.secondTime, duration_minutes: 15, difficulty: "easy", fallback_habit: "Read one page." });
  if (/meditat|mindful/.test(g)) return base({ title: "5-min breathing", category: "mind", duration_minutes: 5, difficulty: "micro", fallback_habit: "10 slow breaths." });
  if (/screen|phone|focus/.test(g)) return base({ title: "Phone-free first 30 min", category: "productivity", preferred_time: "morning", duration_minutes: 30, difficulty: "medium", fallback_habit: "Phone face-down 10 min." });
  if (/water|hydrat/.test(g)) return base({ title: "3 water breaks", category: "nutrition", duration_minutes: 2, difficulty: "micro", fallback_habit: "One glass at lunch." });
  if (/journal|reflect/.test(g)) return base({ title: "3-line journal", category: "mind", preferred_time: "evening", duration_minutes: 5, difficulty: "easy", fallback_habit: "One sentence: 'Today I…'" });
  if (/project|ship|deep.?work/.test(g)) return base({ title: "Deep-work block", category: "productivity", frequency: "weekdays", preferred_time: "morning", duration_minutes: ctx.lowEnergy ? 25 : 45, difficulty: ctx.lowEnergy ? "easy" : "medium", fallback_habit: "15 min on the one priority task." });

  return base({ title: goal, purpose: `Make steady progress on: ${goal}` });
}
