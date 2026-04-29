"use server";

import { revalidatePath } from "next/cache";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { calendarDateInTimeZone } from "@/lib/date";

export async function saveDailyMood(
  mood: number
): Promise<{ ok: boolean; error?: string }> {
  if (mood < 1 || mood > 5) return { ok: false, error: "Mood must be 1–5" };
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not authenticated" };
  const supabase = createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user.id)
    .maybeSingle();
  const today = calendarDateInTimeZone(profile?.timezone ?? "UTC");
  const { error } = await supabase
    .from("daily_moods")
    .upsert({ user_id: user.id, mood_date: today, mood }, { onConflict: "user_id,mood_date" });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard");
  return { ok: true };
}
