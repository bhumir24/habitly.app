// Cron target: runs once per day (just after midnight in each user's timezone).
// For every active habit that was due yesterday but has no log, inserts a "skipped" entry
// so streaks, completion rates, and dashboards reflect the missed day accurately.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { calendarDateInTimeZone, prevCalendarDay, isHabitScheduledForCalendarDay } from "@/lib/date";

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

  // Fetch all active habits with their user's timezone
  const { data: habits } = await admin
    .from("habits")
    .select("id, user_id, frequency, custom_days")
    .eq("is_active", true);

  if (!habits?.length) return NextResponse.json({ ok: true, skipped: 0 });

  // Fetch timezones for all users who have active habits
  const userIds = [...new Set(habits.map((h) => h.user_id))];
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, timezone")
    .in("id", userIds);
  const tzMap = new Map((profiles ?? []).map((p) => [p.id, p.timezone ?? "UTC"]));

  // For each user, figure out their "yesterday"
  const userYesterdayMap = new Map<string, string>();
  for (const uid of userIds) {
    const tz = tzMap.get(uid) ?? "UTC";
    const today = calendarDateInTimeZone(tz);
    userYesterdayMap.set(uid, prevCalendarDay(today));
  }

  // Collect habit IDs that were due yesterday per user
  const dueYesterday: { user_id: string; habit_id: string; date: string }[] = [];
  for (const h of habits) {
    const yesterday = userYesterdayMap.get(h.user_id)!;
    const tz = tzMap.get(h.user_id) ?? "UTC";
    if (isHabitScheduledForCalendarDay(h.frequency, h.custom_days, yesterday, tz)) {
      dueYesterday.push({ user_id: h.user_id, habit_id: h.id, date: yesterday });
    }
  }

  if (!dueYesterday.length) return NextResponse.json({ ok: true, skipped: 0 });

  // Fetch existing logs for those habit+date combos so we don't double-insert
  const habitIds = dueYesterday.map((d) => d.habit_id);
  const dates = [...new Set(dueYesterday.map((d) => d.date))];
  const { data: existingLogs } = await admin
    .from("habit_logs")
    .select("habit_id, completion_date")
    .in("habit_id", habitIds)
    .in("completion_date", dates);

  const loggedSet = new Set(
    (existingLogs ?? []).map((l) => `${l.habit_id}|${l.completion_date}`)
  );

  // Build insert rows for habits with no log yesterday
  const toInsert = dueYesterday
    .filter((d) => !loggedSet.has(`${d.habit_id}|${d.date}`))
    .map((d) => ({
      user_id: d.user_id,
      habit_id: d.habit_id,
      completion_date: d.date,
      status: "skipped",
      mood: null,
      blocker_note: "Auto-skipped: no activity logged",
    }));

  if (!toInsert.length) return NextResponse.json({ ok: true, skipped: 0 });

  const { error } = await admin.from("habit_logs").insert(toInsert);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, skipped: toInsert.length });
}
