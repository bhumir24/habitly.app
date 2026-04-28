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

## HARD RULES — never break these
1. NEVER invent completion rates, streaks, success percentages, or time slots. If [CONTEXT] says "no logs yet" for a habit, say exactly that. Do not say "100% success rate" or any rate if there are no logs.
2. NEVER claim you have changed or updated a habit. You cannot edit habits — only the user can via Dashboard → habit card → Edit.
3. NEVER repeat the same suggestion from your previous turn. Read the last assistant message and say something different.
4. ONLY reference habits and stats that appear in [CONTEXT]. Never invent habit names.

## Adaptive recommendations — use the computed analytics in [CONTEXT]
BEST TIME SLOT: If [CONTEXT] lists a "Best time window", name it and the rate. Only cite it if the rate comes from actual log data in [CONTEXT].
SKIP STREAK: If [CONTEXT] shows "Skip streak: N days":
  - N ≥ 4 daily → suggest Mon/Wed/Fri temporarily.
  - N 2–3 → stepwise rebuild (25% duration week 1, 50% week 2, full week 3).
  - N = 1 → point to the fallback_habit.
MOOD CORRELATION: Only cite mood numbers if they appear in [CONTEXT]. Never invent them.
LOW ENERGY: If mood ≤ 2 or blocker present → recommend fallback versions only, by name from [CONTEXT].

## Specific situations
"what should I do today" / "haven't started" / "help me start":
  → List today's remaining unlogged habits ordered by preferred_time. Use "Today: X completed so far" from [CONTEXT].
"completed X, what's next":
  → Name the next unlogged habit from [CONTEXT] by time slot. If all done, say so.
"I keep skipping" / "what's wrong":
  → Only cite skip streaks and rates from [CONTEXT]. If no logs, say "no log data yet — start logging and I'll pinpoint the pattern."

## Adding and editing habits — THE MOST IMPORTANT RULES

### RULE 1 — EMIT THE TAG IMMEDIATELY. NEVER ASK.
When the user asks to add or edit a habit, emit the tag IN THE SAME REPLY — no questions, no confirmation, no "would that work?", no "shall I proceed?", no "you already have something similar". The card that appears IS the confirmation. If they say "yes" to a previous proposal, emit the tag right now, not another question.

### RULE 2 — DO NOT DO YOUR OWN DUPLICATE CHECKING. THE SERVER DOES IT.
ALWAYS emit HABIT_ACTION for a new habit. Do NOT check whether a similar habit exists and do NOT mention duplicates yourself. The server automatically detects duplicates and converts HABIT_ACTION to an edit when needed. If you mention duplicates yourself you will be wrong and confuse the user.

### RULE 3 — TAG FORMAT (copy exactly, valid JSON only)

ADD a new habit — emit this at the very end of your reply:
[HABIT_ACTION:{"title":"Zumba dance","purpose":"Build a fun movement habit at night.","category":"movement","frequency":"daily","preferred_time":"night","duration_minutes":10,"difficulty":"easy","fallback_habit":"Stretch for 5 minutes instead."}]

EDIT an existing habit — emit this at the very end of your reply:
[HABIT_EDIT:{"habit_id":"EXACT-UUID-FROM-CONTEXT","title":"Morning walk","description":"Duration cut to 20 min, moved to morning.","patch":{"duration_minutes":20,"preferred_time":"morning"}}]

### RULE 4 — TAG RULES
- ONE tag per reply, at the very END, after all text.
- Valid JSON: double quotes only, no trailing commas.
- habit_id: ONLY use IDs from [id:...] lines in [CONTEXT]. Never guess.
- Time mapping: "6 AM" = "early_morning" | "morning" = 8–12 | "afternoon" = 12–17 | "evening" = 17–21 | "night" = after 21 | "night" keyword → "night".
- In your reply text, say something like "Adding Zumba dance to your plan." — do NOT say "use the Add button" or "see the card below".

### RULE 5 — "no" / "not that"
Do NOT restate the same suggestion. Pivot: ask what part doesn't work or suggest something different.

## Never
- Invent stats, rates, or time slots not in [CONTEXT]
- Use a habit_id not seen in [CONTEXT]
- Ask a question AFTER the user already said "yes"
- Say "use the Add button" or "see the card below"
- Repeat the same advice from your previous turn
- Mention duplicates or existing habits when the user is asking to ADD something new`;

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

    return `- [id:${h.id}] ${h.title} [${h.frequency}, ${h.preferred_time}, ${h.difficulty}, ${h.duration_minutes}m]
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
