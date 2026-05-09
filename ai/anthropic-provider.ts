import Anthropic from "@anthropic-ai/sdk";
import type { AIProvider } from "./provider";
import { MockProvider } from "./mock-provider";
import {
  ADAPTATION_SYSTEM,
  COACH_SYSTEM,
  PLAN_SYSTEM,
  WEEKLY_SYSTEM,
  adaptationUserPrompt,
  coachContextBlock,
  historyForModel,
  planUserPrompt,
  weeklyUserPrompt,
} from "./prompts";
import type { Adaptation, GeneratedPlan } from "@/types";

export class AnthropicProvider implements AIProvider {
  name = "anthropic";
  private client: Anthropic;
  private model: string;
  private fallback = new MockProvider();

  constructor() {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    this.model = process.env.ANTHROPIC_MODEL ?? "claude-3-5-sonnet-latest";
  }

  async generatePlan(input: Parameters<AIProvider["generatePlan"]>[0]): Promise<GeneratedPlan> {
    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 2048,
        system: PLAN_SYSTEM + "\n\nOutput ONLY valid JSON. No markdown fences.",
        messages: [{ role: "user", content: planUserPrompt(input.onboarding) }],
      });
      const raw = response.content[0]?.type === "text" ? response.content[0].text : "{}";
      const parsed = JSON.parse(raw) as GeneratedPlan;
      if (!Array.isArray(parsed.habits) || !parsed.habits.length) throw new Error("empty");
      return parsed;
    } catch {
      return this.fallback.generatePlan(input);
    }
  }

  async coachReply(input: Parameters<AIProvider["coachReply"]>[0]): Promise<string> {
    try {
      const contextBlock = coachContextBlock(input);
      const history = historyForModel(input.history);

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 512,
        system: COACH_SYSTEM + "\n\n" + contextBlock,
        messages: [
          ...history,
          { role: "user", content: input.userMessage },
        ],
      });

      const text = response.content[0]?.type === "text" ? response.content[0].text.trim() : "";
      if (!text) throw new Error("empty");
      return text;
    } catch {
      return this.fallback.coachReply(input);
    }
  }

  async adapt(input: Parameters<AIProvider["adapt"]>[0]): Promise<Adaptation[]> {
    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1024,
        system: ADAPTATION_SYSTEM + "\n\nOutput ONLY a valid JSON array. No markdown fences.",
        messages: [{ role: "user", content: adaptationUserPrompt(input.habits, input.logs, input.onboarding) }],
      });
      const raw = response.content[0]?.type === "text" ? response.content[0].text.trim() : "[]";
      const parsed = JSON.parse(raw) as Adaptation[];
      if (!Array.isArray(parsed)) throw new Error("not an array");
      return parsed;
    } catch {
      return this.fallback.adapt(input);
    }
  }

  async weeklyInsight(input: Parameters<AIProvider["weeklyInsight"]>[0]) {
    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 512,
        system: WEEKLY_SYSTEM + "\n\nOutput ONLY valid JSON. No markdown fences.",
        messages: [{ role: "user", content: weeklyUserPrompt(input.summary, input.onboarding) }],
      });
      const raw = response.content[0]?.type === "text" ? response.content[0].text : "{}";
      const parsed = JSON.parse(raw) as { insight: string; next_step: string };
      if (!parsed.insight || !parsed.next_step) throw new Error("empty");
      return parsed;
    } catch {
      return this.fallback.weeklyInsight(input);
    }
  }
}
