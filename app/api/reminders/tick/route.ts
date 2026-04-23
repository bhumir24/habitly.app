// Cron target: poll every minute (e.g. Vercel Cron) and fire due reminders.
// Uses the Supabase service role key to bypass RLS for a system-wide sweep.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ConsoleChannel, shouldFire } from "@/services/reminder-service";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ ok: false, error: "service_role_missing" }, { status: 503 });
  }
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: reminders } = await admin
    .from("reminders")
    .select("id, user_id, habit_id, remind_at, enabled, last_sent_at, channel")
    .eq("enabled", true);

  const now = new Date();
  const due = (reminders ?? []).filter((r) => shouldFire(r as any, now));
  if (due.length === 0) return NextResponse.json({ ok: true, fired: 0 });

  const habitIds = [...new Set(due.map((r) => r.habit_id))];
  const { data: habits } = await admin
    .from("habits")
    .select("id, title, duration_minutes, fallback_habit, is_active, user_id")
    .in("id", habitIds);

  const channel = new ConsoleChannel();
  const habitMap = new Map((habits ?? []).map((h) => [h.id, h]));
  let fired = 0;
  for (const r of due) {
    const h = habitMap.get(r.habit_id);
    if (!h?.is_active) continue;
    await channel.send({
      to: r.user_id,
      title: `⏰ ${h.title}`,
      body: `${h.duration_minutes}m · fallback: ${h.fallback_habit ?? "2-min version"}`,
    });
    await admin.from("reminders").update({ last_sent_at: new Date().toISOString() }).eq("id", r.id);
    fired++;
  }
  return NextResponse.json({ ok: true, fired });
}
