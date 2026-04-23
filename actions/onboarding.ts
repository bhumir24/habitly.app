"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { onboardingSchema, type OnboardingInput } from "@/lib/validations";
import { getAIProvider } from "@/ai/provider";
import type { GeneratedPlan } from "@/types";
import { idealReminderTime } from "@/services/reminder-service";

export async function saveOnboarding(input: OnboardingInput) {
  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid" };
  }
  const user = await getSessionUser();
  if (!user) return { ok: false as const, error: "Not authenticated" };

  const supabase = createClient();

  const { error: oErr } = await supabase
    .from("onboarding_responses")
    .upsert(
      { ...parsed.data, user_id: user.id },
      { onConflict: "user_id" }
    );
  if (oErr) return { ok: false as const, error: oErr.message };

  const { error: pErr } = await supabase
    .from("profiles")
    .update({
      life_mode: parsed.data.life_mode,
      energy_baseline: parsed.data.energy_level,
      onboarded_at: new Date().toISOString(),
    })
    .eq("id", user.id);
  if (pErr) return { ok: false as const, error: pErr.message };

  revalidatePath("/plan-review");
  return { ok: true as const };
}

export async function generatePlan(): Promise<
  | { ok: true; plan: GeneratedPlan }
  | { ok: false; error: string }
> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const supabase = createClient();
  const { data: onboarding } = await supabase
    .from("onboarding_responses")
    .select("*")
    .eq("user_id", user.id)
    .single();
  if (!onboarding) return { ok: false, error: "Complete onboarding first" };

  const ai = await getAIProvider();
  const plan = await ai.generatePlan({ onboarding });
  return { ok: true, plan };
}

export async function acceptPlan(plan: GeneratedPlan) {
  const user = await getSessionUser();
  if (!user) return { ok: false as const, error: "Not authenticated" };

  const supabase = createClient();

  // Deactivate any prior AI-sourced habits to avoid dupes on re-acceptance.
  await supabase
    .from("habits")
    .update({ is_active: false })
    .eq("user_id", user.id)
    .eq("source", "ai");

  const rows = plan.habits.map((h) => ({
    user_id: user.id,
    title: h.title,
    purpose: h.purpose,
    category: h.category,
    frequency: h.frequency,
    preferred_time: h.preferred_time,
    duration_minutes: h.duration_minutes,
    difficulty: h.difficulty,
    fallback_habit: h.fallback_habit,
    source: "ai",
    is_active: true,
  }));
  const { data: inserted, error } = await supabase
    .from("habits")
    .insert(rows)
    .select("id, preferred_time, scheduled_at");

  if (error) return { ok: false as const, error: error.message };

  // Seed in-app reminders at ideal times.
  if (inserted?.length) {
    await supabase.from("reminders").insert(
      inserted.map((h) => ({
        user_id: user.id,
        habit_id: h.id,
        remind_at: idealReminderTime({
          preferred_time: h.preferred_time,
          scheduled_at: h.scheduled_at,
        }),
        channel: "in_app",
        enabled: true,
      }))
    );
  }

  revalidatePath("/dashboard");
  redirect("/dashboard");
}
