// Cron target: called every minute (Vercel Cron).
// Sends one consolidated email per user listing all their due habits for that time slot.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { EmailChannel, shouldFire } from "@/services/reminder-service";
import type { Reminder } from "@/types";

export const dynamic = "force-dynamic";

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
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

  const allUserIds = [...new Set((reminders ?? []).map((r) => r.user_id))];
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, timezone")
    .in("id", allUserIds);
  const tzMap = new Map((profiles ?? []).map((p) => [p.id, p.timezone ?? "UTC"]));

  const now = new Date();
  const due = (reminders ?? []).filter((r) =>
    shouldFire(r as Reminder, now, tzMap.get(r.user_id) ?? "UTC")
  );
  if (due.length === 0) return NextResponse.json({ ok: true, fired: 0 });

  const habitIds = [...new Set(due.map((r) => r.habit_id))];
  const { data: habits } = await admin
    .from("habits")
    .select("id, title, duration_minutes, fallback_habit, is_active")
    .in("id", habitIds);
  const habitMap = new Map((habits ?? []).map((h) => [h.id, h]));

  // Group due reminders by user, skipping inactive habits
  const byUser = new Map<string, typeof due>();
  for (const r of due) {
    const h = habitMap.get(r.habit_id);
    if (!h?.is_active) continue;
    const list = byUser.get(r.user_id) ?? [];
    list.push(r);
    byUser.set(r.user_id, list);
  }

  // Fetch emails for all users with due reminders
  const userEmailMap = new Map<string, string>();
  for (const uid of [...byUser.keys()]) {
    const { data } = await admin.auth.admin.getUserById(uid);
    if (data?.user?.email) userEmailMap.set(uid, data.user.email);
  }

  const emailChannel = new EmailChannel();
  const reminderIds: string[] = [];
  let fired = 0;

  for (const [userId, userReminders] of byUser) {
    const email = userEmailMap.get(userId);
    if (!email) continue;

    const timeStr = userReminders[0].remind_at.slice(0, 5);
    const dateStr = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    const habitItems = userReminders.map((r) => {
      const h = habitMap.get(r.habit_id)!;
      return { title: h.title, duration: h.duration_minutes, fallback: h.fallback_habit };
    });

    await emailChannel.sendDigest({ to: email, time: timeStr, date: dateStr, habits: habitItems });
    fired++;
    userReminders.forEach((r) => reminderIds.push(r.id));
  }

  if (reminderIds.length > 0) {
    await admin
      .from("reminders")
      .update({ last_sent_at: now.toISOString() })
      .in("id", reminderIds);
  }

  return NextResponse.json({ ok: true, fired });
}
