import type {
  CoachMessage,
  Habit,
  HabitLog,
  OnboardingResponse,
  WeeklySummary,
} from "@/types";

export const PLAN_SYSTEM = `You are an adaptive habit coach. Design a realistic, personalised starter plan.
Rules:
- Honor the user's daily availability (do not exceed it).
- Match energy_level and life_mode — low energy gets micro/easy habits only.
- Each habit MUST have: title, purpose, category, frequency, preferred_time,
  duration_minutes, difficulty, and a fallback_habit (1 sentence) that works on bad days.
- Prefer 3–6 habits. Never more than 8.
- No generic templates. Reference user goals and blockers explicitly in purpose.
- Output strict JSON matching the provided schema.`;

export function planUserPrompt(o: OnboardingResponse) {
  return `User context:
- Goals: ${o.goals.join("; ") || "—"}
- Daily availability: ${o.availability_min} minutes
- Routine: ${JSON.stringify(o.routine)}
- Energy level: ${o.energy_level}
- Life mode: ${o.life_mode}
- Blockers: ${o.blockers.join("; ") || "—"}
- Preferred time windows: ${o.preferred_times.join(", ") || "any"}
- Notes: ${o.notes ?? "—"}

Return JSON of the form:
{
  "rationale": "2–3 sentences tying the plan to user goals & constraints.",
  "habits": [
    {
      "title": "string",
      "purpose": "string",
      "category": "health|mind|productivity|learning|social|sleep|nutrition|movement|other",
      "frequency": "daily|weekdays|weekends|3x_week|5x_week|custom",
      "preferred_time": "early_morning|morning|midday|afternoon|evening|night|any",
      "duration_minutes": number,
      "difficulty": "micro|easy|medium|hard",
      "fallback_habit": "string"
    }
  ]
}`;
}

export const COACH_SYSTEM = `You are the user's personal habit coach inside Habitly.
Style: warm, direct, pragmatic. 2–4 short sentences. No lectures. No emojis unless the user uses them first.

## Core rules
- Answer EVERY question — habits, schedule, goals, health, productivity, or general wellbeing.
- Always reference real data from [CONTEXT]. Never invent habits, stats, or logs.
- Never repeat what you said in the previous assistant turn. Always move forward.
- Be specific: name the actual habit, duration, and time slot. Avoid generic advice.

## Adaptive recommendations — use the computed analytics in [CONTEXT]
BEST TIME SLOT: If [CONTEXT] lists a "Best time window" with a high success rate, proactively recommend scheduling the next habit there. Name the window and the rate.
SKIP STREAK: If a habit has "Skip streak: N days" in [CONTEXT]:
  - N ≥ 4 and daily → suggest dropping to Mon/Wed/Fri temporarily. Frame as rebuilding momentum, not quitting.
  - N 2–3 → suggest a stepwise rebuild: start at 25% of the full duration this week, 50% next week, full the week after.
  - N = 1 → acknowledge and point to the fallback_habit.
MOOD CORRELATION: If [CONTEXT] shows "Mood correlation" with skip/complete averages, cite those specific numbers to explain WHY the user tends to skip. Then suggest what to do on low-mood days (fallback version, shorter duration, or different time slot).
FREQUENCY RESET: Framing reduced frequency as a tool (not failure) is always valid when a habit has a low completion rate. Suggest it proactively for habits below 50% rate with ≥ 5 logs.
LOW ENERGY DAYS: If current mood ≤ 2 or blocker is present, recommend only the fallback version of each habit — not the full version. Name each habit's specific fallback from [CONTEXT].

## Specific situations
"what should I do today" / "haven't started" / "help me start":
  → Give an ordered list of today's remaining habits by preferred_time slot, starting with the easiest. If all logged, celebrate and suggest a bonus micro-habit.

"completed X, what's next":
  → Identify the next unlogged habit from [CONTEXT] ordered by time slot and tell the user to do that one.

Missed / skipped:
  → Acknowledge without shame. Reference the specific fallback_habit. Suggest the smallest possible restart.

Want to add a new habit:
  → At the END of your reply, emit exactly one tag: [HABIT_ACTION:{"title":"...","purpose":"...","category":"health|mind|productivity|learning|social|sleep|nutrition|movement|other","frequency":"daily|weekdays|weekends|3x_week|5x_week|custom","preferred_time":"early_morning|morning|midday|afternoon|evening|night|any","duration_minutes":number,"difficulty":"micro|easy|medium|hard","fallback_habit":"..."}]
  Do NOT mention this tag in your reply text. Do NOT suggest adding to plan in text — the card handles that.

## Never
- Generic clichés like "you've got this" or "keep going"
- Repeat the same advice from the previous assistant message
- Make up completion numbers or habits not in [CONTEXT]
- End with an open-ended question every single time — sometimes just give the answer`;

export function coachContextBlock(input: {
  onboarding: OnboardingResponse | null;
  activeHabits: Habit[];
  recentLogs: HabitLog[];
  mood?: number;
  blocker?: string;
}) {
  const { activeHabits, recentLogs, mood, blocker, onboarding } = input;
  const today = new Date().toISOString().slice(0, 10);
  const todayLogs = recentLogs.filter((l) => l.completion_date === today);

  // Per-habit analytics
  const habitLines = activeHabits.map((h) => {
    const hLogs = recentLogs.filter((l) => l.habit_id === h.id);
    const done = hLogs.filter((l) => l.status === "completed").length;
    const skipped = hLogs.filter((l) => l.status === "skipped").length;
    const total = done + skipped;
    const rate = total > 0 ? `${Math.round((done / total) * 100)}%` : "no logs yet";

    // Skip streak (consecutive skips from most recent)
    const sorted = [...hLogs].sort((a, b) => b.completion_date.localeCompare(a.completion_date));
    let skipStreak = 0;
    for (const l of sorted) {
      if (l.status === "skipped") skipStreak++;
      else break;
    }

    // Today's log for this habit
    const todayLog = todayLogs.find((l) => l.habit_id === h.id);
    const todayStatus = todayLog ? todayLog.status : "not logged";

    // Mood correlation for this habit
    const moodLogs = hLogs.filter((l) => l.mood !== null);
    let moodNote = "";
    if (moodLogs.length >= 5) {
      const completeMoods = moodLogs.filter((l) => l.status === "completed").map((l) => l.mood!);
      const skipMoods = moodLogs.filter((l) => l.status === "skipped").map((l) => l.mood!);
      if (completeMoods.length >= 2 && skipMoods.length >= 2) {
        const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
        const cAvg = avg(completeMoods);
        const sAvg = avg(skipMoods);
        if (cAvg - sAvg >= 0.5) {
          moodNote = ` | Mood correlation: avg ${cAvg.toFixed(1)} on complete days, ${sAvg.toFixed(1)} on skip days`;
        }
      }
    }

    return `- ${h.title} [${h.frequency}, ${h.preferred_time}, ${h.difficulty}, ${h.duration_minutes}m]
    Completion: ${rate} (${done} done / ${skipped} skipped) | Today: ${todayStatus}${skipStreak >= 2 ? ` | Skip streak: ${skipStreak} days` : ""}${moodNote}
    Fallback: ${h.fallback_habit ?? "—"}`;
  });

  // Best time window across all habits
  const windowMap = new Map<string, { done: number; total: number }>();
  for (const h of activeHabits) {
    const hLogs = recentLogs.filter((l) => l.habit_id === h.id);
    const done = hLogs.filter((l) => l.status === "completed").length;
    const total = hLogs.filter((l) => l.status === "completed" || l.status === "skipped").length;
    if (total < 2) continue;
    const w = windowMap.get(h.preferred_time) ?? { done: 0, total: 0 };
    w.done += done;
    w.total += total;
    windowMap.set(h.preferred_time, w);
  }
  const bestWindow = [...windowMap.entries()]
    .filter(([, v]) => v.total >= 2)
    .sort(([, a], [, b]) => b.done / b.total - a.done / a.total)[0];

  // Overall mood correlation across all habits
  const allMooded = recentLogs.filter((l) => l.mood !== null);
  let overallMoodLine = "";
  if (allMooded.length >= 5) {
    const cMoods = allMooded.filter((l) => l.status === "completed").map((l) => l.mood!);
    const sMoods = allMooded.filter((l) => l.status === "skipped").map((l) => l.mood!);
    if (cMoods.length >= 2 && sMoods.length >= 2) {
      const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
      const cAvg = avg(cMoods);
      const sAvg = avg(sMoods);
      if (cAvg - sAvg >= 0.5) {
        overallMoodLine = `Overall mood correlation: ${cAvg.toFixed(1)}/5 on complete days vs ${sAvg.toFixed(1)}/5 on skip days — mood is a strong predictor.`;
      }
    }
  }

  const allDone = recentLogs.filter((l) => l.status === "completed").length;
  const allSkipped = recentLogs.filter((l) => l.status === "skipped").length;
  const totalLogged = allDone + allSkipped;
  const overallRate = totalLogged > 0 ? `${Math.round((allDone / totalLogged) * 100)}%` : "no data";
  const todayDone = todayLogs.filter((l) => l.status === "completed").length;

  return `[CONTEXT]
Goals: ${onboarding?.goals.join("; ") ?? "—"}
Blockers from setup: ${onboarding?.blockers.join("; ") || "—"}
Life mode: ${onboarding?.life_mode ?? "—"} | Energy baseline: ${onboarding?.energy_level ?? "—"}
Daily availability: ${onboarding?.availability_min ?? "—"} min
${mood ? `Current mood: ${mood}/5` : ""}${blocker ? ` | Current blocker: ${blocker}` : ""}

Today (${today}): ${todayDone} completed so far
14-day overall: ${allDone} completed, ${allSkipped} skipped — ${overallRate} rate
${bestWindow ? `Best time window: ${bestWindow[0].replace(/_/g, " ")} (${Math.round((bestWindow[1].done / bestWindow[1].total) * 100)}% success rate)` : ""}
${overallMoodLine}

Active habits (${activeHabits.length}):
${habitLines.join("\n") || "No active habits."}
[/CONTEXT]`;
}

export function historyForModel(history: CoachMessage[]) {
  return history.slice(-12).map((m) => ({
    role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
    content: m.content,
  }));
}

export const WEEKLY_SYSTEM = `You summarise a user's habit week. Output JSON only.
{
 "insight": "3–4 sentence analysis. Mention best window, biggest friction, and one surprising pattern.",
 "next_step": "ONE concrete change for next week. Specific, small, testable."
}
Keep it human, no generic coaching clichés.`;

export function weeklyUserPrompt(
  summary: WeeklySummary,
  onboarding: OnboardingResponse | null
) {
  return `Week summary:
Completion rate: ${Math.round(summary.completion_rate * 100)}% (${summary.total_completed}/${summary.total_scheduled})
Skipped: ${summary.total_skipped}
Streak (days with ≥1 completion): ${summary.streak_days}
Mood avg: ${summary.mood_avg ?? "n/a"}
Top blockers: ${summary.top_blockers.join(", ") || "—"}
Most skipped: ${summary.most_skipped.map((h) => `${h.title}×${h.count}`).join(", ") || "—"}
Best windows: ${summary.best_windows.map((b) => `${b.window} ${Math.round(b.completion_rate * 100)}%`).join(", ") || "—"}
Per-habit: ${summary.per_habit.map((p) => `${p.title}: ${p.completed}/${p.completed + p.skipped}`).join("; ")}
User goals: ${onboarding?.goals.join("; ") ?? "—"}
Life mode: ${onboarding?.life_mode ?? "—"} / Energy: ${onboarding?.energy_level ?? "—"}`;
}
