import type { Onboarding } from "@workspace/db";

export interface GeneratedHabit {
  title: string;
  purpose: string;
  frequency: "daily" | "weekdays" | "weekends" | "custom";
  durationMinutes: number;
  bestTimeOfDay: "morning" | "afternoon" | "evening" | "anytime";
  difficulty: "easy" | "medium" | "hard";
  fallbackMicroHabit: string;
}

function getTimeFromEnergy(energy: string): "morning" | "afternoon" | "evening" | "anytime" {
  if (energy === "high") return "morning";
  if (energy === "medium") return "afternoon";
  return "evening";
}

function getFrequency(dailyMinutes: number, goal: string): "daily" | "weekdays" | "weekends" | "custom" {
  if (dailyMinutes < 10) return "weekdays";
  if (goal.toLowerCase().includes("relax") || goal.toLowerCase().includes("weekend")) return "weekends";
  return "daily";
}

const habitTemplates: Record<string, GeneratedHabit> = {
  fitness: {
    title: "Morning Movement",
    purpose: "Build consistent physical activity to boost energy and mood",
    frequency: "daily",
    durationMinutes: 15,
    bestTimeOfDay: "morning",
    difficulty: "medium",
    fallbackMicroHabit: "Do 5 jumping jacks or stretch for 2 minutes",
  },
  sleep: {
    title: "Wind-Down Routine",
    purpose: "Improve sleep quality through a consistent pre-sleep ritual",
    frequency: "daily",
    durationMinutes: 10,
    bestTimeOfDay: "evening",
    difficulty: "easy",
    fallbackMicroHabit: "Put your phone in another room for 5 minutes before sleep",
  },
  meditation: {
    title: "Mindful Pause",
    purpose: "Reduce stress and build mental clarity through short meditation",
    frequency: "daily",
    durationMinutes: 10,
    bestTimeOfDay: "morning",
    difficulty: "easy",
    fallbackMicroHabit: "Take 3 slow deep breaths before starting your day",
  },
  reading: {
    title: "Daily Reading",
    purpose: "Expand knowledge and reduce screen time before bed",
    frequency: "daily",
    durationMinutes: 20,
    bestTimeOfDay: "evening",
    difficulty: "easy",
    fallbackMicroHabit: "Read just one page or one article",
  },
  journaling: {
    title: "Reflection Journal",
    purpose: "Process thoughts, track progress, and build self-awareness",
    frequency: "daily",
    durationMinutes: 10,
    bestTimeOfDay: "evening",
    difficulty: "easy",
    fallbackMicroHabit: "Write one sentence about how you felt today",
  },
  nutrition: {
    title: "Mindful Eating",
    purpose: "Build healthier eating habits without strict dieting",
    frequency: "daily",
    durationMinutes: 5,
    bestTimeOfDay: "morning",
    difficulty: "medium",
    fallbackMicroHabit: "Add one vegetable or fruit to your next meal",
  },
  focus: {
    title: "Deep Work Block",
    purpose: "Protect focused time for your most important work",
    frequency: "weekdays",
    durationMinutes: 25,
    bestTimeOfDay: "morning",
    difficulty: "hard",
    fallbackMicroHabit: "Work on your top priority for just 5 minutes, uninterrupted",
  },
  hydration: {
    title: "Hydration Habit",
    purpose: "Stay consistently hydrated throughout the day",
    frequency: "daily",
    durationMinutes: 2,
    bestTimeOfDay: "morning",
    difficulty: "easy",
    fallbackMicroHabit: "Drink one glass of water right now",
  },
};

function matchGoalToTemplate(goal: string): GeneratedHabit | null {
  const lower = goal.toLowerCase();
  if (lower.includes("exercise") || lower.includes("fitness") || lower.includes("workout") || lower.includes("walk") || lower.includes("run")) {
    return habitTemplates.fitness;
  }
  if (lower.includes("sleep") || lower.includes("rest") || lower.includes("insomnia")) {
    return habitTemplates.sleep;
  }
  if (lower.includes("meditat") || lower.includes("mindful") || lower.includes("stress") || lower.includes("anxiety") || lower.includes("calm")) {
    return habitTemplates.meditation;
  }
  if (lower.includes("read") || lower.includes("book") || lower.includes("learn")) {
    return habitTemplates.reading;
  }
  if (lower.includes("journal") || lower.includes("writ") || lower.includes("reflect")) {
    return habitTemplates.journaling;
  }
  if (lower.includes("eat") || lower.includes("diet") || lower.includes("nutrition") || lower.includes("weight") || lower.includes("food")) {
    return habitTemplates.nutrition;
  }
  if (lower.includes("focus") || lower.includes("productiv") || lower.includes("work") || lower.includes("study")) {
    return habitTemplates.focus;
  }
  if (lower.includes("water") || lower.includes("hydrat")) {
    return habitTemplates.hydration;
  }
  return null;
}

export function generateHabitPlan(onboarding: Onboarding): GeneratedHabit[] {
  const habits: GeneratedHabit[] = [];
  const timePerHabit = Math.max(5, Math.floor(onboarding.dailyMinutes / Math.max(1, onboarding.goals.length)));
  const bestTime = getTimeFromEnergy(onboarding.energyLevel);

  for (const goal of onboarding.goals) {
    const template = matchGoalToTemplate(goal);
    if (template) {
      const adapted: GeneratedHabit = {
        ...template,
        durationMinutes: Math.min(template.durationMinutes, timePerHabit),
        bestTimeOfDay: onboarding.energyLevel === "low" ? "evening" : bestTime,
        frequency: getFrequency(onboarding.dailyMinutes, goal),
      };

      if (onboarding.energyLevel === "low") {
        adapted.difficulty = "easy";
        adapted.durationMinutes = Math.min(adapted.durationMinutes, 10);
      }

      if (onboarding.blockers.some(b => b.toLowerCase().includes("time"))) {
        adapted.durationMinutes = Math.min(adapted.durationMinutes, 10);
      }

      habits.push(adapted);
    } else {
      habits.push({
        title: `${goal.charAt(0).toUpperCase() + goal.slice(1)} Practice`,
        purpose: `Work toward your goal: ${goal}`,
        frequency: getFrequency(onboarding.dailyMinutes, goal),
        durationMinutes: timePerHabit,
        bestTimeOfDay: bestTime,
        difficulty: onboarding.energyLevel === "low" ? "easy" : "medium",
        fallbackMicroHabit: `Spend just 2 minutes on ${goal.toLowerCase()}`,
      });
    }
  }

  if (habits.length === 0) {
    habits.push({
      title: "Daily Check-In",
      purpose: "Build awareness of your daily habits and energy",
      frequency: "daily",
      durationMinutes: 5,
      bestTimeOfDay: "morning",
      difficulty: "easy",
      fallbackMicroHabit: "Take 60 seconds to notice how you feel today",
    });
  }

  return habits;
}

export function generateCoachReply(
  userMessage: string,
  mood: number | null | undefined,
  blockerNote: string | null | undefined,
  habits: { title: string; currentStreak: number; completionRate: number | null }[],
): string {
  const lower = userMessage.toLowerCase();

  if (mood !== null && mood !== undefined && mood <= 2) {
    return "I hear you — some days just feel heavy, and that's completely valid. On days like this, the micro-habit is your best friend. What's the absolute smallest version of one habit you could do today? Even 2 minutes counts. You don't need to earn rest, but a tiny action can shift your momentum.";
  }

  if (blockerNote && (blockerNote.toLowerCase().includes("time") || lower.includes("busy") || lower.includes("no time"))) {
    return "Time pressure is real — let's not pretend otherwise. Pick one habit, reduce it to its smallest form, and attach it to something you're already doing. Brush your teeth → take 3 deep breaths. Morning coffee → read one paragraph. What's one habit we could shrink to fit?";
  }

  if (lower.includes("skip") || lower.includes("missed") || lower.includes("failed") || lower.includes("gave up")) {
    return "Missing a day doesn't break the streak — it just means yesterday was hard. The goal isn't a perfect record; it's a long-term relationship with the habit. What got in the way? If it's a pattern, we might need to adjust the habit itself, not your willpower.";
  }

  if (lower.includes("motivat") || lower.includes("lazy") || lower.includes("don't feel like") || lower.includes("can't")) {
    return "Motivation is overrated — it shows up after you start, not before. The trick is to make the first step so small it's hard to say no. What if you just did 1% of the habit right now? Put on the workout clothes. Open the journal. That's all. You can stop there if you want.";
  }

  if (lower.includes("tired") || lower.includes("exhausted") || lower.includes("sleep") || lower.includes("drained")) {
    return "Your energy is your fuel — don't ignore signals when it's running low. On low-energy days, lean into the micro-habits only. Protect your sleep above all else; every other habit gets easier when you're rested. Is there anything in your schedule draining more than it gives?";
  }

  if (lower.includes("great") || lower.includes("amazing") || lower.includes("doing well") || lower.includes("good progress") || lower.includes("streak")) {
    const bestHabit = habits.filter(h => h.currentStreak > 2).sort((a, b) => b.currentStreak - a.currentStreak)[0];
    if (bestHabit) {
      return `That's real momentum — ${bestHabit.title} with a ${bestHabit.currentStreak}-day streak is something to be proud of. Consistency builds identity. You're not just doing the habit anymore; you're becoming the kind of person who does it. What feels ready to level up?`;
    }
    return "That's genuine progress — it's worth pausing to notice it. Consistency compounds quietly. Keep going and you'll be surprised what a few more weeks of this feels like.";
  }

  if (lower.includes("which habit") || lower.includes("focus on") || lower.includes("prioritize") || lower.includes("where to start")) {
    const weakest = habits.filter(h => h.isActive).sort((a, b) => (a.completionRate ?? 0) - (b.completionRate ?? 0))[0];
    if (weakest) {
      return `I'd start with the one that feels most stuck: "${weakest.title}". Not because you have to fix everything, but because unsticking one thing creates momentum everywhere. What's making it hard to show up for that one?`;
    }
    return "Start with the habit that makes every other habit easier. Usually that's sleep or a morning routine. Build that foundation first, then layer on the others.";
  }

  return "Good question. The most important thing right now is consistency over intensity — a small action every day beats a big effort once a week. What's one habit you want to talk through today?";
}

export function generateWeeklyInsight(
  completedCount: number,
  skippedCount: number,
  totalLogs: number,
  averageMood: number | null,
  topHabitTitle: string | null,
  habitCount: number,
): { summary: string; nextStep: string } {
  const rate = totalLogs > 0 ? completedCount / totalLogs : 0;
  const ratePercent = Math.round(rate * 100);

  let summary = "";
  let nextStep = "";

  if (rate >= 0.8) {
    summary = `An excellent week — you completed ${ratePercent}% of your habits. That kind of consistency is rare and it compounds fast. ${averageMood !== null && averageMood >= 4 ? "Your mood scores were high too, which suggests the habits are genuinely improving your daily experience." : "Keep an eye on your energy levels to make sure you're not burning out."} ${topHabitTitle ? `"${topHabitTitle}" was your standout habit this week.` : ""}`;
    nextStep = "Consider adding one new habit or increasing the difficulty of an existing one. You've built a strong foundation — it can hold more weight.";
  } else if (rate >= 0.5) {
    summary = `A solid week with room to grow — ${ratePercent}% completion across ${habitCount} active habits. ${skippedCount > 0 ? `${skippedCount} habits were skipped, which is worth examining — were they skipped due to time, energy, or motivation?` : ""} ${averageMood !== null ? `Your average mood was ${averageMood.toFixed(1)}/5, which tells us something about how the week felt beyond just the numbers.` : ""}`;
    nextStep = "Pick one habit that was skipped the most and have a conversation with it: is it timed wrong, too ambitious, or just uninspiring? Adjust it before next week.";
  } else {
    summary = `A tough week — ${ratePercent}% completion, but you showed up enough to generate this report, which matters. ${skippedCount > completedCount ? "More skips than completions this week suggests the plan might need adjusting rather than more willpower." : ""} ${averageMood !== null && averageMood <= 2 ? "Your mood scores were low — make sure the habits you're tracking are actually supporting you, not adding pressure." : ""}`;
    nextStep = "Take one habit off the list or cut it in half. You're not failing at habits — the habits might be failing you. Simpler is always more sustainable.";
  }

  return { summary, nextStep };
}
