// AI abstraction layer.
// All AI calls in the app go through this interface. Swapping providers
// (mock → OpenAI → Anthropic) is a single env flag away.

import type {
  Adaptation,
  CoachMessage,
  GeneratedPlan,
  Habit,
  HabitLog,
  OnboardingResponse,
  WeeklySummary,
} from "@/types";

export interface AIProvider {
  name: string;
  generatePlan(input: {
    onboarding: OnboardingResponse;
    existingHabits?: Habit[];
  }): Promise<GeneratedPlan>;

  coachReply(input: {
    history: CoachMessage[];
    userMessage: string;
    profileContext: {
      life_mode: string;
      energy_baseline: string;
      timezone: string;
      /** First name from profile full_name — for addressing the user naturally */
      first_name?: string;
    };
    onboarding: OnboardingResponse | null;
    activeHabits: Habit[];
    recentLogs: HabitLog[];
    mood?: number;
    blocker?: string;
  }): Promise<string>;

  adapt(input: {
    habits: Habit[];
    logs: HabitLog[];
    onboarding: OnboardingResponse | null;
  }): Promise<Adaptation[]>;

  weeklyInsight(input: {
    summary: WeeklySummary;
    onboarding: OnboardingResponse | null;
  }): Promise<{ insight: string; next_step: string }>;
}

export async function getAIProvider(): Promise<AIProvider> {
  const configured = (process.env.AI_PROVIDER ?? "mock").toLowerCase();

  if (configured === "anthropic" && process.env.ANTHROPIC_API_KEY) {
    const { AnthropicProvider } = await import("./anthropic-provider");
    return new AnthropicProvider();
  }

  if (configured === "openai" && process.env.OPENAI_API_KEY) {
    const { OpenAIProvider } = await import("./openai-provider");
    return new OpenAIProvider();
  }

  const { MockProvider } = await import("./mock-provider");
  return new MockProvider();
}
