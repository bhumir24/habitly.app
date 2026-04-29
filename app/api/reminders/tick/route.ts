// Cron target: called every minute (Vercel Cron or external scheduler).
// Uses the Supabase service role key to bypass RLS for a system-wide sweep.
// Routes each due reminder to the correct channel (in_app → console, email → Resend).

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ConsoleChannel, EmailChannel, shouldFire } from "@/services/reminder-service";
import type { Reminder } from "@/types";

export const dynamic = "force-dynamic";

// Reject requests that don't carry the shared cron secret (set in Vercel env).
function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // dev: no secret configured
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
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
  const due = (reminders ?? []).filter((r) => shouldFire(r as Reminder, now));
  if (due.length === 0) return NextResponse.json({ ok: true, fired: 0 });

  // Fetch habits for all due reminders in one query
  const habitIds = [...new Set(due.map((r) => r.habit_id))];
  const { data: habits } = await admin
    .from("habits")
    .select("id, title, duration_minutes, fallback_habit, is_active")
    .in("id", habitIds);
  const habitMap = new Map((habits ?? []).map((h) => [h.id, h]));

  // Fetch email addresses for users who have email-channel reminders due
  const emailUserIds = [...new Set(
    due.filter((r) => r.channel === "email").map((r) => r.user_id)
  )];
  const userEmailMap = new Map<string, string>();
  for (const uid of emailUserIds) {
    const { data } = await admin.auth.admin.getUserById(uid);
    if (data?.user?.email) userEmailMap.set(uid, data.user.email);
  }

  const emailChannel = new EmailChannel();
  const consoleChannel = new ConsoleChannel();
  let fired = 0;

  for (const r of due) {
    const h = habitMap.get(r.habit_id);
    if (!h?.is_active) continue;

    const title = `⏰ Time for: ${h.title}`;
    const body = `${h.duration_minutes} min · Fallback if short on time: ${h.fallback_habit ?? "2-min version"}`;

    if (r.channel === "email") {
      const email = userEmailMap.get(r.user_id);
      if (!email) continue;
      await emailChannel.send({ to: email, title, body });
    } else {
      await consoleChannel.send({ to: r.user_id, title, body });
    }

    await admin
      .from("reminders")
      .update({ last_sent_at: new Date().toISOString() })
      .eq("id", r.id);
    fired++;
  }

  return NextResponse.json({ ok: true, fired });
}
