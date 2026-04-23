import OpenAI from "openai";
import type { AIProvider } from "./provider";
import { MockProvider } from "./mock-provider";
import {
  COACH_SYSTEM,
  PLAN_SYSTEM,
  WEEKLY_SYSTEM,
  coachContextBlock,
  historyForModel,
  planUserPrompt,
  weeklyUserPrompt,
} from "./prompts";
import type { Adaptation, GeneratedPlan } from "@/types";

// Real AI provider. Falls back to the MockProvider for any call
// that errors, so the app never hard-fails in front of a user.
export class OpenAIProvider implements AIProvider {
  name = "openai";
  private client: OpenAI;
  private model: string;
  private fallback = new MockProvider();

  constructor() {
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  }

  async generatePlan(input: Parameters<AIProvider["generatePlan"]>[0]) {
    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        response_format: { type: "json_object" },
        temperature: 0.6,
        messages: [
          { role: "system", content: PLAN_SYSTEM },
          { role: "user", content: planUserPrompt(input.onboarding) },
        ],
      });
      const raw = completion.choices[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(raw) as GeneratedPlan;
      if (!Array.isArray(parsed.habits) || !parsed.habits.length) throw new Error("empty");
      return parsed;
    } catch {
      return this.fallback.generatePlan(input);
    }
  }

  async coachReply(input: Parameters<AIProvider["coachReply"]>[0]) {
    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        temperature: 0.5,
        messages: [
          { role: "system", content: COACH_SYSTEM },
          { role: "system", content: coachContextBlock(input) },
          ...historyForModel(input.history),
          { role: "user", content: input.userMessage },
        ],
      });
      const text = completion.choices[0]?.message?.content?.trim();
      if (!text) throw new Error("empty");
      return text;
    } catch {
      return this.fallback.coachReply(input);
    }
  }

  // The mock adaptation engine is deterministic & cheap — prefer it.
  // Advanced adaptation (premium) is a good place to plug the LLM later.
  async adapt(input: Parameters<AIProvider["adapt"]>[0]): Promise<Adaptation[]> {
    return this.fallback.adapt(input);
  }

  async weeklyInsight(input: Parameters<AIProvider["weeklyInsight"]>[0]) {
    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        response_format: { type: "json_object" },
        temperature: 0.5,
        messages: [
          { role: "system", content: WEEKLY_SYSTEM },
          { role: "user", content: weeklyUserPrompt(input.summary, input.onboarding) },
        ],
      });
      const raw = completion.choices[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(raw) as { insight: string; next_step: string };
      if (!parsed.insight || !parsed.next_step) throw new Error("empty");
      return parsed;
    } catch {
      return this.fallback.weeklyInsight(input);
    }
  }
}
