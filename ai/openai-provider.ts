import OpenAI from "openai";
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
        messages: [
          { role: "system", content: COACH_SYSTEM + "\n\n" + coachContextBlock(input) },
          ...historyForModel(input.history),
          { role: "user", content: input.userMessage },
        ],
      });
      const text = completion.choices[0]?.message?.content?.trim();
      if (!text) throw new Error("empty");
      return text;
    } catch (err) {
      console.error("[OpenAIProvider] coachReply failed:", err);
      return this.fallback.coachReply(input);
    }
  }

  async adapt(input: Parameters<AIProvider["adapt"]>[0]): Promise<Adaptation[]> {
    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: ADAPTATION_SYSTEM + "\n\nWrap your array in {\"adaptations\": [...]} since json_object mode requires an object root." },
          { role: "user", content: adaptationUserPrompt(input.habits, input.logs, input.onboarding) },
        ],
      });
      const raw = completion.choices[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(raw) as { adaptations?: Adaptation[] } | Adaptation[];
      const list = Array.isArray(parsed) ? parsed : (parsed as { adaptations?: Adaptation[] }).adaptations ?? [];
      if (!Array.isArray(list)) throw new Error("not an array");
      return list;
    } catch {
      return this.fallback.adapt(input);
    }
  }

  async weeklyInsight(input: Parameters<AIProvider["weeklyInsight"]>[0]) {
    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        response_format: { type: "json_object" },
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
