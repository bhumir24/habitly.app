import {
  addDays,
  differenceInCalendarDays,
  format,
  getDay,
  isSameDay,
  parseISO,
  startOfWeek,
} from "date-fns";

export const todayISO = () => format(new Date(), "yyyy-MM-dd");

export const toISODate = (d: Date) => format(d, "yyyy-MM-dd");

export const mondayOf = (d: Date = new Date()) =>
  startOfWeek(d, { weekStartsOn: 1 });

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
