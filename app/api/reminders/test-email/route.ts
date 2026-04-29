// Dev-only endpoint — sends a test reminder email immediately.
// Usage: GET /api/reminders/test-email?to=you@example.com
// Remove or gate this behind CRON_SECRET before going to production.

import { NextResponse } from "next/server";
import { EmailChannel } from "@/services/reminder-service";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const to = new URL(req.url).searchParams.get("to");
  if (!to) {
    return NextResponse.json({ ok: false, error: "Pass ?to=your@email.com" }, { status: 400 });
  }

  const channel = new EmailChannel();
  await channel.sendDigest({
    to,
    time: "08:00",
    date: new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }),
    habits: [
      { title: "Morning Run", duration: 30, fallback: "10-min walk" },
      { title: "Drink Water", duration: 0, fallback: null },
    ],
  });

  return NextResponse.json({ ok: true, sentTo: to });
}
