// Reminder scheduling + mock notification delivery.
// Architected so a real provider (FCM, APNs, Expo Push, email) just
// implements the `NotificationChannel` interface.

import type { Habit, Reminder, TimeOfDay } from "@/types";

export interface NotificationChannel {
  name: string;
  send(payload: { to: string; title: string; body: string }): Promise<void>;
}

// Dev/test stub — logs instead of sending. Swap with real channel in prod.
export class ConsoleChannel implements NotificationChannel {
  name = "console";
  async send(p: { to: string; title: string; body: string }) {
    console.log(`[reminder → ${p.to}] ${p.title} — ${p.body}`);
  }
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
