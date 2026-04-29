"use server";

import { createClient, getSessionUser } from "@/lib/supabase/server";
import { revalidateTrackerPages } from "@/actions/revalidate";
import type { EnergyLevel, LifeMode, Reminder } from "@/types";

export interface ReminderSaveItem {
  id?: string; // undefined = new row to insert
  habit_id: string;
  remind_at: string;
  enabled: boolean;
  channel: Reminder["channel"];
}

export interface SaveSettingsInput {
  full_name: string | null;
  timezone: string;
  life_mode: LifeMode;
  energy_baseline: EnergyLevel;
  lifeModes: LifeMode[];
  reminders: ReminderSaveItem[];
  hasOnboarding: boolean;
  onboardingRoutine: Record<string, unknown>;
}

export async function saveSettings(
  input: SaveSettingsInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const supabase = createClient();

  // Update profile — use update (not upsert) to avoid the INSERT RLS gap.
  // Profiles are always created by the auth trigger on sign-up.
  const { error: profileErr } = await supabase
    .from("profiles")
    .update({
      full_name: input.full_name,
      timezone: input.timezone,
      life_mode: input.life_mode,
      energy_baseline: input.energy_baseline,
    })
    .eq("id", user.id);

  if (profileErr) return { ok: false, error: profileErr.message };

  // Sync life_mode array into onboarding_responses if it exists
  if (input.hasOnboarding) {
    const modes =
      input.lifeModes.length >= 1 ? input.lifeModes.slice(0, 2) : [input.life_mode];
    const { error: onboardErr } = await supabase
      .from("onboarding_responses")
      .update({
        routine: { ...input.onboardingRoutine, life_modes: modes },
        life_mode: input.life_mode,
      })
      .eq("user_id", user.id);
    if (onboardErr) return { ok: false, error: onboardErr.message };
  }

  // Save reminder changes — update existing rows, insert new ones
  for (const r of input.reminders) {
    if (r.id) {
      const { error: remErr } = await supabase
        .from("reminders")
        .update({ remind_at: r.remind_at, enabled: r.enabled, channel: r.channel })
        .eq("id", r.id)
        .eq("user_id", user.id);
      if (remErr) return { ok: false, error: remErr.message };
    } else {
      // New reminder row (habit had none before)
      const { error: insErr } = await supabase
        .from("reminders")
        .insert({
          user_id: user.id,
          habit_id: r.habit_id,
          remind_at: r.remind_at,
          enabled: r.enabled,
          channel: r.channel,
        });
      if (insErr) return { ok: false, error: insErr.message };
    }
  }

  await revalidateTrackerPages();
  return { ok: true };
}
