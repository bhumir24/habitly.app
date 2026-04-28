import {
  addDays,
  differenceInCalendarDays,
  format,
  getDay,
  isSameDay,
  parseISO,
  startOfWeek,
} from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

export const todayISO = () => format(new Date(), "yyyy-MM-dd");

export const toISODate = (d: Date) => format(d, "yyyy-MM-dd");

export const mondayOf = (d: Date = new Date()) =>
  startOfWeek(d, { weekStartsOn: 1 });

export function normalizeTimeZone(timeZone: string | undefined | null): string {
  const t = timeZone?.trim();
  return t || "UTC";
}

/** Calendar YYYY-MM-DD in the user's IANA timezone. */
export function calendarDateInTimeZone(
  timeZone: string | undefined | null,
  instant: Date = new Date()
): string {
  const tz = normalizeTimeZone(timeZone);
  try {
    return formatInTimeZone(instant, tz, "yyyy-MM-dd");
  } catch {
    return format(instant, "yyyy-MM-dd");
  }
}

export function prevCalendarDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return format(dt, "yyyy-MM-dd");
}

export function nextCalendarDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + 1);
  return format(dt, "yyyy-MM-dd");
}

/** JS weekday 0=Sun … 6=Sat for a calendar date in `timeZone`. */
export function dayOfWeekForCalendarDate(
  calendarISO: string,
  timeZone: string | undefined | null
): number {
  const tz = normalizeTimeZone(timeZone);
  const instant = parseISO(`${calendarISO}T12:00:00.000Z`);
  try {
    const i = Number(formatInTimeZone(instant, tz, "i"));
    return i === 7 ? 0 : i;
  } catch {
    return getDay(instant);
  }
}

/** Monday YYYY-MM-DD of the week containing `todayISO` in `timeZone`. */
export function mondayOfCalendarWeekContaining(
  todayISO: string,
  timeZone: string | undefined | null
): string {
  const dow = dayOfWeekForCalendarDate(todayISO, timeZone);
  const daysBack = dow === 0 ? 6 : dow - 1;
  let iso = todayISO;
  for (let i = 0; i < daysBack; i++) iso = prevCalendarDay(iso);
  return iso;
}

export function isHabitScheduledForCalendarDay(
  frequency: string,
  customDays: number[] | null,
  calendarISO: string,
  timeZone: string | undefined | null
): boolean {
  const dow = dayOfWeekForCalendarDate(calendarISO, timeZone);
  switch (frequency) {
    case "daily":
      return true;
    case "weekdays":
      return dow >= 1 && dow <= 5;
    case "weekends":
      return dow === 0 || dow === 6;
    case "3x_week":
      return [1, 3, 5].includes(dow);
    case "5x_week":
      return [1, 2, 3, 4, 5].includes(dow);
    case "custom":
      return Array.isArray(customDays) ? customDays.includes(dow) : false;
    default:
      return true;
  }
}

export function last7Days(): string[] {
  const out: string[] = [];
  for (let i = 6; i >= 0; i--) out.push(toISODate(addDays(new Date(), -i)));
  return out;
}

export function isHabitScheduledToday(
  frequency: string,
  customDays: number[] | null,
  date: Date = new Date()
): boolean {
  const dow = getDay(date); // 0=Sun..6=Sat
  switch (frequency) {
    case "daily":
      return true;
    case "weekdays":
      return dow >= 1 && dow <= 5;
    case "weekends":
      return dow === 0 || dow === 6;
    case "3x_week":
      // Mon/Wed/Fri
      return [1, 3, 5].includes(dow);
    case "5x_week":
      return [1, 2, 3, 4, 5].includes(dow);
    case "custom":
      return Array.isArray(customDays) ? customDays.includes(dow) : false;
    default:
      return true;
  }
}

export function friendlyDay(dateISO: string) {
  const d = parseISO(dateISO);
  if (isSameDay(d, new Date())) return "Today";
  const diff = differenceInCalendarDays(new Date(), d);
  if (diff === 1) return "Yesterday";
  return format(d, "EEE, MMM d");
}

export { format, parseISO, addDays, differenceInCalendarDays, startOfWeek };
