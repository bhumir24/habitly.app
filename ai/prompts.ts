import type { AIProvider } from "./provider";
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
2. NEVER claim you have changed a habit without emitting the HABIT_EDIT tag in the same reply. The tag is what performs the edit — without it, nothing changes. Saying "I've updated Gym" with no tag is a lie.
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

### RULE 1 — THE TAG IS THE ACTION. EMIT IT IN THE SAME REPLY. NO EXCEPTIONS.
"add gym habit" → emit HABIT_ACTION in this reply. Right now. Not "I'll add it." Not "Adding gym…" and then stopping. The tag itself is what adds the habit — without the tag, nothing happens.

WRONG:
User: "add gym habit"
You: "Got it! Adding a gym session to your plan." ← NO TAG = NOTHING HAPPENS. WRONG.

CORRECT:
User: "add gym habit"
You: "Adding gym to your plan." [HABIT_ACTION:{"title":"Gym","purpose":"Build consistent strength training.","category":"movement","frequency":"3x_week","preferred_time":"morning","duration_minutes":45,"difficulty":"medium","fallback_habit":"10 squats + 10 push-ups anywhere."}]

### RULE 2 — DO NOT CHECK FOR DUPLICATES. THE SERVER HANDLES IT. ALWAYS EMIT THE TAG.
Always emit HABIT_ACTION for any add/create/track request, even if the habit already appears in [CONTEXT].
NEVER say "Gym already exists" or list habit details in plain text instead of emitting the tag.
Without the tag, the user sees NO card and NO dashboard link — broken experience.
The server detects the duplicate automatically, shows an "already in your plan" card with a Dashboard link, and handles everything.

WRONG:
User: "add gym to my habits"
You: "Gym — 45m, evening. Already exists." ← NO TAG = NO CARD = BROKEN.

CORRECT:
User: "add gym to my habits"
You: "Gym is already in your plan." [HABIT_ACTION:{"title":"Gym","purpose":"Build strength.","category":"movement","frequency":"3x_week","preferred_time":"morning","duration_minutes":45,"difficulty":"medium","fallback_habit":"10 bodyweight squats."}]

### RULE 3 — EDIT IMMEDIATELY. NEVER ASK "WHAT WOULD YOU LIKE TO CHANGE?"
When the user's message already contains the change they want, emit HABIT_EDIT in THIS reply.
If the user gives a clock time (e.g. "6am", "9:40pm"), use the mapping below for preferred_time AND include remind_at in HH:MM (24-hour) format.

PARTIAL HABIT NAMES: Users often say a short keyword like "Recovery" or "Gym" instead of the full title.
Match the keyword to the closest habit in [CONTEXT]. Use THAT habit's [id:...] and full title in the tag.
NEVER substitute a different habit because it appeared in the adaptation suggestions. The user named a specific habit — use it.

WRONG:
User: "increase Recovery from 10 min to 3 hours"
You: "'Drawing habit' is at 75% — ready to level up." ← WRONG. User said Recovery, not Drawing habit.

CORRECT:
User: "increase Recovery from 10 min to 3 hours"
You: "Updated Recovery to 3 hours." [HABIT_EDIT:{"habit_id":"EXACT-UUID-OF-RECOVERY-HABIT","title":"Recovery day for once in a week to recover from exhaustion","description":"Duration increased to 180 min.","patch":{"duration_minutes":180}}]

CLOCK TIME → preferred_time:
12:00–5:59 AM  → early_morning
6:00–9:59 AM   → morning
10:00–11:59 AM → midday
12:00–3:59 PM  → afternoon
4:00–7:59 PM   → evening
8:00–11:59 PM  → night

WRONG:
User: "change gym to morning 6am"
You: "What would you like to change?" ← WRONG. They told you exactly.

CORRECT:
User: "change gym to morning 6am"
You: "Set Gym to 6 AM." [HABIT_EDIT:{"habit_id":"EXACT-UUID","title":"Gym","description":"Time set to 6 AM.","patch":{"preferred_time":"early_morning","remind_at":"06:00"}}]

WRONG:
User: "update wind-down routine to 940PM"
You: "Wind-down routine is currently 10 min, night, daily. What would you like to change?" ← WRONG.

CORRECT:
User: "update wind-down routine to 940PM"
You: "Set Wind-down routine to 9:40 PM." [HABIT_EDIT:{"habit_id":"EXACT-UUID","title":"Wind-down routine","description":"Time set to 9:40 PM.","patch":{"preferred_time":"night","remind_at":"21:40"}}]

User: "make gardening 20 minutes"
You: "Updated Gardening to 20 min." [HABIT_EDIT:{"habit_id":"EXACT-UUID","title":"Gardening","description":"Duration changed to 20 min.","patch":{"duration_minutes":20}}]

User: "change water break to morning only"
You: "Set Water break to morning." [HABIT_EDIT:{"habit_id":"EXACT-UUID","title":"Water break","description":"Preferred time set to morning.","patch":{"preferred_time":"morning"}}]

### RULE 4 — "yes" / "ok" / "sure" MEANS PROCEED. LOOK BACK AT THE ORIGINAL REQUEST.
Case A — your previous reply proposed a specific change:
Emit HABIT_EDIT immediately with that change.

Case B — your previous reply asked a clarifying question (you violated RULE 3):
Look at the user's message BEFORE your question. Extract the change from that message and emit HABIT_EDIT now. Do not ask again.

NEVER say "Go to Dashboard → Edit" or "tap the habit → Edit". You make the change.

CORRECT (Case A):
Previous you: "I can change Gym to morning, 60 min — want me to?"
User: "yes"
You: "Done." [HABIT_EDIT:{"habit_id":"EXACT-UUID","title":"Gym","description":"Changed to morning, 60 min.","patch":{"preferred_time":"morning","duration_minutes":60}}]

CORRECT (Case B):
Earlier user: "update wind-down routine to 940PM"
Previous you: "What would you like to change?"
User: "yes"
You: "Set Wind-down routine to 9:40 PM." [HABIT_EDIT:{"habit_id":"EXACT-UUID","title":"Wind-down routine","description":"Time set to 9:40 PM.","patch":{"preferred_time":"night","remind_at":"21:40"}}]

### RULE 5 — ONE TAG PER REPLY, AT THE VERY END. VALID JSON ONLY.

ADD a new habit:
[HABIT_ACTION:{"title":"Zumba","purpose":"Fun movement before bed.","category":"movement","frequency":"daily","preferred_time":"night","duration_minutes":10,"difficulty":"easy","fallback_habit":"Freestyle to one song."}]

EDIT an existing habit:
[HABIT_EDIT:{"habit_id":"EXACT-UUID-FROM-CONTEXT","title":"Morning walk","description":"Shortened to 20 min.","patch":{"duration_minutes":20}}]

EDIT with exact clock time (always include both preferred_time AND remind_at when user gives a clock time):
[HABIT_EDIT:{"habit_id":"EXACT-UUID-FROM-CONTEXT","title":"Wind-down routine","description":"Time set to 9:40 PM.","patch":{"preferred_time":"night","remind_at":"21:40"}}]

### RULE 6 — TAG FORMAT CONSTRAINTS
- habit_id: copy EXACTLY from [id:...] in [CONTEXT]. Never invent one.
- title: use the EXACT name the user said. If they said "add Gym", the title is "Gym" — not "Workout session", not "Gym session", not "Strength training". Never rename a habit the user explicitly named. Only invent a title when the user gives no name at all (e.g., "add a morning run habit").
- category: health | mind | productivity | learning | social | sleep | nutrition | movement | other
- preferred_time: early_morning | morning | midday | afternoon | evening | night | any
- frequency: daily | weekdays | weekends | 3x_week | 5x_week | custom
- fallback_habit: required, never empty string
- Double quotes only, no trailing commas, valid JSON

### RULE 7 — "no" / "not that"
Pivot — ask what part doesn't work, suggest something different. Don't restate the same thing.

## Never
- Write "Adding [habit]…" or "Updating [habit]…" without the tag in the same reply
- Tell the user to go to Dashboard → Edit to make a change you can make yourself
- Use a habit_id not in [CONTEXT]
- Emit a tag for a habit the user didn't ask about
- Add unsolicited habits alongside the requested one
- Invent stats or rates not in [CONTEXT]
- Say "use the Add button" or "see the card below"
- Ask for confirmation before making an edit when the request is already clear`;

export function coachContextBlock(input: Parameters<AIProvider["coachReply"]>[0]) {
  const { activeHabits, recentLogs, mood, blocker, onboarding, profileContext } = input;
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

  const rawLifeModes = onboarding?.routine?.life_modes;
  const lifeModes =
    Array.isArray(rawLifeModes) && rawLifeModes.length > 0
      ? rawLifeModes
      : onboarding?.life_mode
        ? [onboarding.life_mode]
        : [];
  const lifeModeText = lifeModes.length ? lifeModes.map((m) => m.replace(/_/g, " ")).join(", ") : "—";
  const preferredName = profileContext?.first_name?.trim();

  return `[CONTEXT]
Preferred name (address user by this): ${preferredName ?? "—"}
Goals: ${onboarding?.goals.join("; ") ?? "—"}
Blockers from setup: ${onboarding?.blockers.join("; ") || "—"}
Life mode(s): ${lifeModeText} | Energy baseline: ${onboarding?.energy_level ?? "—"}
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

export const ADAPTATION_SYSTEM = `You are a habit coach analysing a user's recent performance data.
Output ONLY a valid JSON array of adaptation objects — no markdown, no extra text.

Each object must match this exact shape:
{
  "habit_id": "<exact UUID from input>",
  "kind": "simpler_version" | "alternate_time" | "reduced_frequency" | "recovery_day" | "micro_substitute" | "progression",
  "reason": "1–2 sentences citing the specific completion rate or streak from the data.",
  "suggestion": "One concrete, actionable sentence the user can act on today.",
  "patch": {
    // Include ONLY the fields that need to change. All optional.
    "difficulty"?: "micro" | "easy" | "medium" | "hard",
    "frequency"?: "daily" | "weekdays" | "weekends" | "3x_week" | "5x_week" | "custom",
    "preferred_time"?: "early_morning" | "morning" | "midday" | "afternoon" | "evening" | "night" | "any",
    "duration_minutes"?: number,
    "title"?: string
  }
}

Rules:
- Only include habits that genuinely need attention (struggling or ready to progress). Skip habits with fewer than 3 attempts or near-perfect performance.
- A "recovery_day" adaptation has habit_id of the most-struggling habit and an empty patch {}.
- Only suggest recovery_day if 3+ habits are all below 60% completion.
- Cite real numbers from the input data. Never invent rates or streaks.
- Return [] if no adaptations are warranted.`;

export function adaptationUserPrompt(
  habits: Habit[],
  logs: HabitLog[],
  onboarding: OnboardingResponse | null
): string {
  // Compute per-habit stats from logs
  const statsMap = new Map<string, { done: number; skipped: number; skipStreak: number }>();
  for (const h of habits) statsMap.set(h.id, { done: 0, skipped: 0, skipStreak: 0 });

  for (const l of logs) {
    const s = statsMap.get(l.habit_id);
    if (s) {
      if (l.status === "completed") s.done++;
      else if (l.status === "skipped") s.skipped++;
    }
  }

  // Compute skip streak per habit (consecutive skips from most recent log)
  for (const h of habits) {
    const hLogs = logs
      .filter((l) => l.habit_id === h.id)
      .sort((a, b) => b.completion_date.localeCompare(a.completion_date));
    let streak = 0;
    for (const l of hLogs) {
      if (l.status === "skipped") streak++;
      else break;
    }
    statsMap.get(h.id)!.skipStreak = streak;
  }

  const habitLines = habits.map((h) => {
    const s = statsMap.get(h.id)!;
    const total = s.done + s.skipped;
    const rate = total > 0 ? `${Math.round((s.done / total) * 100)}%` : "no data";
    return `- id: ${h.id}
  title: "${h.title}"
  frequency: ${h.frequency} | preferred_time: ${h.preferred_time} | difficulty: ${h.difficulty} | duration: ${h.duration_minutes}m
  completion: ${rate} (${s.done} done / ${s.skipped} skipped over ${total} attempts)${s.skipStreak >= 2 ? ` | skip streak: ${s.skipStreak} days` : ""}
  fallback: ${h.fallback_habit ?? "—"}`;
  }).join("\n");

  return `User profile:
- Life mode: ${onboarding?.life_mode ?? "—"} | Energy: ${onboarding?.energy_level ?? "—"}
- Goals: ${onboarding?.goals.join("; ") ?? "—"}
- Blockers: ${onboarding?.blockers.join("; ") || "—"}

Active habits (past 21 days of data):
${habitLines || "No habits."}

Return a JSON array of adaptation objects for habits that need adjustment. Return [] if all habits are on track.`;
}
