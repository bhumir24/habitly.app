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

export const COACH_SYSTEM = `You are the user's habit coach inside an app.
Style: warm, concise, pragmatic. 2–4 short sentences. No lectures, no emojis unless user uses them.
Behavior rules:
- Missed streaks → acknowledge, remove shame, suggest a micro-substitute.
- Low motivation → name one tiny next step the user can do right now.
- No time → propose a 2-minute fallback version.
- Low energy / bad sleep → lighten today, not long-term.
- Overambitious plans → suggest dropping one habit or lowering difficulty.
- Always reference the user's actual habits/logs when relevant. Never invent habits.
- If a system adaptation is suggested, describe it in plain words and ask if they want to apply it.`;

export function coachContextBlock(input: {
  onboarding: OnboardingResponse | null;
  activeHabits: Habit[];
  recentLogs: HabitLog[];
  mood?: number;
  blocker?: string;
}) {
  const skipped = input.recentLogs.filter((l) => l.status === "skipped");
  const done = input.recentLogs.filter((l) => l.status === "completed");
  return `[CONTEXT]
Goals: ${input.onboarding?.goals.join("; ") ?? "—"}
Life mode: ${input.onboarding?.life_mode ?? "—"} | Energy: ${input.onboarding?.energy_level ?? "—"}
Availability: ${input.onboarding?.availability_min ?? "—"} min/day
Active habits (${input.activeHabits.length}):
${input.activeHabits
  .map(
    (h) =>
      `- ${h.title} (${h.frequency}, ${h.preferred_time}, ${h.difficulty}, ${h.duration_minutes}m) fallback: ${h.fallback_habit ?? "—"}`
  )
  .join("\n") || "—"}
Last 14 days — completed: ${done.length}, skipped: ${skipped.length}
${input.mood ? `Current mood (1-5): ${input.mood}` : ""}
${input.blocker ? `Current blocker: ${input.blocker}` : ""}
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
