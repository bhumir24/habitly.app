// Dev-only — shows all enabled reminders and whether they'd fire right now.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { shouldFire } from "@/services/reminder-service";
import type { Reminder } from "@/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: reminders } = await admin
    .from("reminders")
    .select("id, user_id, habit_id, remind_at, enabled, last_sent_at, channel")
    .eq("enabled", true);

  const now = new Date();
  const rows = (reminders ?? []).map((r) => {
    const [h, m] = r.remind_at.split(":").map(Number);
    const totalMinutes = h * 60 + m - 5;
    const fireH = Math.floor(((totalMinutes % 1440) + 1440) % 1440 / 60);
    const fireM = ((totalMinutes % 1440) + 1440) % 1440 % 60;
    return {
      habit_id: r.habit_id,
      remind_at: r.remind_at,
      fires_at: `${String(fireH).padStart(2,"0")}:${String(fireM).padStart(2,"0")}`,
      current_time: `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`,
      would_fire: shouldFire(r as Reminder, now),
      last_sent_at: r.last_sent_at,
    };
  });

  return NextResponse.json({ now: now.toISOString(), reminders: rows });
}
