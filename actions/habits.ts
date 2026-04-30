"use server";

import { revalidatePath } from "next/cache";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { habitSchema, habitLogSchema, type HabitInput } from "@/lib/validations";
import type { Adaptation } from "@/types";
import { calendarDateInTimeZone } from "@/lib/date";
import { idealReminderTime } from "@/services/reminder-service";

export async function logHabit(input: {
  habit_id: string;
  status: "completed" | "skipped" | "modified";
  mood?: number | null;
  blocker_note?: string | null;
  completion_date?: string;
}) {
  const parsed = habitLogSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid input" };

  const user = await getSessionUser();
  if (!user) return { ok: false as const, error: "Not authenticated" };

  const supabase = createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user.id)
    .maybeSingle();
  const tz = profile?.timezone ?? "UTC";
  const date = parsed.data.completion_date ?? calendarDateInTimeZone(tz);

  const { error } = await supabase.from("habit_logs").upsert(
    {
      habit_id: parsed.data.habit_id,
      user_id: user.id,
      status: parsed.data.status,
      completion_date: date,
      mood: parsed.data.mood ?? null,
      blocker_note: parsed.data.blocker_note ?? null,
    },
    { onConflict: "habit_id,completion_date" }
  );
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/dashboard");
  revalidatePath(`/habit/${parsed.data.habit_id}`);
  return { ok: true as const };
}

export async function updateHabit(id: string, patch: Partial<HabitInput> & { is_active?: boolean }) {
  const user = await getSessionUser();
  if (!user) return { ok: false as const, error: "Not authenticated" };

  // Validate whatever fields were provided.
  const partial = habitSchema.partial().safeParse(patch);
  if (!partial.success) return { ok: false as const, error: "Invalid patch" };

  const supabase = createClient();
  const { error } = await supabase
    .from("habits")
    .update({ ...partial.data, ...(patch.is_active !== undefined ? { is_active: patch.is_active } : {}) })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { ok: false as const, error: error.message };

  // When preferred_time changes, move the reminder to the ideal time for the new slot.
  if (partial.data.preferred_time) {
    await supabase
      .from("reminders")
      .update({ remind_at: idealReminderTime({ preferred_time: partial.data.preferred_time, scheduled_at: null }) })
      .eq("habit_id", id)
      .eq("user_id", user.id);
  }

  revalidatePath("/dashboard");
  revalidatePath(`/habit/${id}`);
  return { ok: true as const };
}

export async function createHabit(
  input: HabitInput,
  reminder?: { enabled: boolean; remindAt: string }
) {
  const parsed = habitSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid habit" };

  const user = await getSessionUser();
  if (!user) return { ok: false as const, error: "Not authenticated" };

  const supabase = createClient();
  const { data, error } = await supabase
    .from("habits")
    .insert({ ...parsed.data, user_id: user.id, source: "user" })
    .select("id")
    .single();
  if (error) return { ok: false as const, error: error.message };

  if (data?.id) {
    // Always create a reminder so Settings shows the right default time.
    // If the user explicitly set one, use their values; otherwise default to ideal time, disabled.
    await supabase.from("reminders").insert({
      user_id: user.id,
      habit_id: data.id,
      remind_at: reminder?.remindAt ?? idealReminderTime({ preferred_time: parsed.data.preferred_time, scheduled_at: null }),
      channel: "email",
      enabled: reminder?.enabled ?? false,
    });
  }

  revalidatePath("/dashboard");
  return { ok: true as const, id: data!.id };
}

export async function reactivateHabit(id: string) {
  const user = await getSessionUser();
  if (!user) return { ok: false as const, error: "Not authenticated" };

  const supabase = createClient();
  const { error } = await supabase
    .from("habits")
    .update({ is_active: true })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/dashboard");
  return { ok: true as const };
}

export async function addGeneratedHabit(
  habit: import("@/types").GeneratedHabit
) {
  const user = await getSessionUser();
  if (!user) return { ok: false as const, error: "Not authenticated" };

  const supabase = createClient();
  const { data, error } = await supabase.from("habits").insert({
    user_id: user.id,
    title: habit.title,
    purpose: habit.purpose,
    category: habit.category,
    frequency: habit.frequency,
    preferred_time: habit.preferred_time,
    duration_minutes: habit.duration_minutes,
    difficulty: habit.difficulty,
    fallback_habit: habit.fallback_habit,
    source: "ai",
    is_active: true,
  }).select("id").single();
  if (error) return { ok: false as const, error: error.message };

  // Auto-create a reminder at the ideal time for this habit's preferred time
  if (data?.id) {
    await supabase.from("reminders").insert({
      user_id: user.id,
      habit_id: data.id,
      remind_at: idealReminderTime({
        preferred_time: habit.preferred_time,
        scheduled_at: null,
      }),
      channel: "email",
      enabled: true,
    });
  }

  revalidatePath("/dashboard");
  return { ok: true as const };
}

export async function applyAdaptation(a: Adaptation) {
  const user = await getSessionUser();
  if (!user) return { ok: false as const, error: "Not authenticated" };

  const supabase = createClient();
  const { error } = await supabase
    .from("habits")
    .update({ ...a.patch, source: "adapted" })
    .eq("id", a.habit_id)
    .eq("user_id", user.id);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/dashboard");
  return { ok: true as const };
}
