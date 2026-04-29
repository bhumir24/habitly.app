// Reminder scheduling + notification delivery.
// Add a new channel by implementing NotificationChannel and wiring it in the tick route.

import { formatInTimeZone } from "date-fns-tz";
import type { Habit, Reminder, TimeOfDay } from "@/types";

export interface NotificationChannel {
  name: string;
  send(payload: { to: string; title: string; body: string }): Promise<void>;
}

// Dev/test stub — logs to console instead of sending.
export class ConsoleChannel implements NotificationChannel {
  name = "console";
  async send(p: { to: string; title: string; body: string }) {
    console.log(`[reminder → ${p.to}] ${p.title} — ${p.body}`);
  }
}

type HabitDigestItem = { title: string; duration: number; fallback: string | null };

// Sends habit reminder emails via Resend (https://resend.com).
// Requires RESEND_API_KEY and RESEND_FROM_EMAIL in environment.
export class EmailChannel implements NotificationChannel {
  name = "email";

  async send(p: { to: string; title: string; body: string }) {
    await this.sendDigest({
      to: p.to,
      time: "",
      date: new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }),
      habits: [{ title: p.title, duration: 0, fallback: p.body }],
    });
  }

  // Sends one consolidated email listing all habits due at a given time.
  async sendDigest(p: { to: string; time: string; date: string; habits: HabitDigestItem[] }) {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL ?? "Habitly <reminders@habitly.app>";
    if (!apiKey) {
      console.warn("[EmailChannel] RESEND_API_KEY not set — skipping email to", p.to);
      return;
    }
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    const subject =
      p.habits.length === 1
        ? `⏰ Starting in 5 min: ${p.habits[0].title} — ${p.time}`
        : `⏰ ${p.habits.length} habits starting at ${p.time} · ${p.date}`;
    const { error } = await resend.emails.send({
      from,
      to: p.to,
      subject,
      html: digestHtml(p),
      text: digestText(p),
    });
    if (error) console.error("[EmailChannel] sendDigest failed:", error);
  }
}

function digestHtml(p: { to: string; time: string; date: string; habits: HabitDigestItem[] }): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://habitly.app";
  const rows = p.habits.map((h) => `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #f3f4f6">
        <p style="margin:0 0 2px;font-size:15px;font-weight:600;color:#111827">${h.title}</p>
        <p style="margin:0;font-size:13px;color:#6b7280">${h.duration > 0 ? `${h.duration} min` : ""}${h.fallback ? ` · Fallback: ${h.fallback}` : ""}</p>
      </td>
    </tr>`).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 0">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden">
        <tr>
          <td style="background:#18181b;padding:20px 32px">
            <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.3px">Habitly</span>
          </td>
        </tr>
        <tr>
          <td style="padding:32px">
            <p style="margin:0 0 4px;font-size:13px;font-weight:500;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px">
              ${p.date}${p.time ? ` · ${p.time}` : ""}
            </p>
            <p style="margin:0 0 24px;font-size:22px;font-weight:700;color:#111827">
              Starting in 5 minutes
            </p>
            <table width="100%" cellpadding="0" cellspacing="0">${rows}</table>
            <div style="height:28px"></div>
            <a href="${appUrl}/dashboard"
               style="display:inline-block;background:#18181b;color:#ffffff;font-size:14px;font-weight:600;
                      text-decoration:none;padding:12px 24px;border-radius:8px">
              Log it now →
            </a>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px;border-top:1px solid #f3f4f6">
            <p style="margin:0;font-size:12px;color:#9ca3af">
              You enabled email reminders in
              <a href="${appUrl}/settings" style="color:#6b7280">Habitly Settings</a>.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function digestText(p: { time: string; date: string; habits: HabitDigestItem[] }): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://habitly.app";
  const lines = p.habits.map((h) =>
    `• ${h.title}${h.duration > 0 ? ` — ${h.duration} min` : ""}${h.fallback ? `\n  Fallback: ${h.fallback}` : ""}`
  );
  return [
    `${p.date}${p.time ? ` · ${p.time}` : ""}`,
    `Starting in 5 minutes`,
    "",
    ...lines,
    "",
    `Log it now: ${appUrl}/dashboard`,
  ].join("\n");
}

type PushSub = { endpoint: string; p256dh: string; auth: string };

export async function sendWebPush(
  subscriptions: PushSub[],
  payload: { title: string; body: string; url?: string }
) {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const email = process.env.VAPID_EMAIL ?? "mailto:reminders@habitly.app";
  if (!publicKey || !privateKey) {
    console.warn("[sendWebPush] VAPID keys not set — skipping push");
    return;
  }
  const { default: webpush } = await import("web-push");
  webpush.setVapidDetails(email, publicKey, privateKey);
  await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload)
      )
    )
  );
}

// Map preferred_time → sensible default clock time.
const DEFAULTS: Record<TimeOfDay, string> = {
  early_morning: "06:30",
  morning: "08:00",
  midday: "12:30",
  afternoon: "15:30",
  evening: "19:00",
  night: "22:30",
  any: "09:00",
};

export function idealReminderTime(habit: Pick<Habit, "preferred_time" | "scheduled_at">): string {
  if (habit.scheduled_at) return habit.scheduled_at.slice(0, 5);
  return DEFAULTS[habit.preferred_time] ?? "09:00";
}

export function shouldFire(
  reminder: Reminder,
  now: Date = new Date(),
  userTimezone = "UTC"
): boolean {
  if (!reminder.enabled) return false;
  const [h, m] = reminder.remind_at.split(":").map(Number);
  // Fire 5 minutes before the scheduled time
  const totalMinutes = h * 60 + m - 5;
  const fireH = Math.floor(((totalMinutes % 1440) + 1440) % 1440 / 60);
  const fireM = ((totalMinutes % 1440) + 1440) % 1440 % 60;
  // Compare against the user's LOCAL time, not UTC server time
  let localH: number;
  let localM: number;
  try {
    localH = Number(formatInTimeZone(now, userTimezone, "H"));
    localM = Number(formatInTimeZone(now, userTimezone, "m"));
  } catch {
    localH = now.getHours();
    localM = now.getMinutes();
  }
  if (localH !== fireH || Math.abs(localM - fireM) > 1) return false;
  // Send at most once per hour — prevents double-fire if the cron overlaps the 2-min window
  if (reminder.last_sent_at) {
    const msSinceLast = now.getTime() - new Date(reminder.last_sent_at).getTime();
    if (msSinceLast < 60 * 60 * 1000) return false;
  }
  return true;
}

export async function fireDueReminders(
  reminders: Reminder[],
  habits: Habit[],
  channel: NotificationChannel,
  userEmail: string,
  now: Date = new Date()
) {
  const habitMap = new Map(habits.map((h) => [h.id, h]));
  for (const r of reminders) {
    if (!shouldFire(r, now)) continue;
    const h = habitMap.get(r.habit_id);
    if (!h || !h.is_active) continue;
    await channel.send({
      to: userEmail,
      title: `⏰ ${h.title}`,
      body: `${h.duration_minutes}m · fallback if tight: ${h.fallback_habit ?? "2-min version"}`,
    });
  }
}
