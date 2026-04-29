// Reminder scheduling + notification delivery.
// Add a new channel by implementing NotificationChannel and wiring it in the tick route.

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

// Sends habit reminder emails via Resend (https://resend.com).
// Requires RESEND_API_KEY and RESEND_FROM_EMAIL in environment.
export class EmailChannel implements NotificationChannel {
  name = "email";

  async send(p: { to: string; title: string; body: string }) {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL ?? "Habitly <reminders@habitly.app>";
    if (!apiKey) {
      console.warn("[EmailChannel] RESEND_API_KEY not set — skipping email to", p.to);
      return;
    }
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to: p.to,
      subject: p.title,
      html: emailHtml(p.title, p.body),
      text: `${p.title}\n\n${p.body}\n\nOpen Habitly: ${process.env.NEXT_PUBLIC_APP_URL ?? "https://habitly.app"}`,
    });
    if (error) console.error("[EmailChannel] send failed:", error);
  }
}

function emailHtml(title: string, body: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://habitly.app";
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
            <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;line-height:1.3">${title}</p>
            <p style="margin:0 0 28px;font-size:15px;color:#6b7280;line-height:1.6">${body}</p>
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
              You're receiving this because you enabled email reminders in
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

export function shouldFire(reminder: Reminder, now: Date = new Date()): boolean {
  if (!reminder.enabled) return false;
  const [h, m] = reminder.remind_at.split(":").map(Number);
  return now.getHours() === h && Math.abs(now.getMinutes() - m) <= 1;
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
