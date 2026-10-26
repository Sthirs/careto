/** Local calendar date as `YYYY-MM-DD`, the format of `Dish.pausedUntil`. */
export function toIsoDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Parses `YYYY-MM-DD` as a local date (not UTC midnight). */
export function fromIsoDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, date.getDate());
}

/** "9 Nov" / "9 nov" in the active locale. */
export function formatShortDate(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(fromIsoDate(iso));
}

/** "Mon 9 Nov" in the active locale. */
export function formatWeekdayDate(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' }).format(
    fromIsoDate(iso),
  );
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** "6 weeks ago", "yesterday", "3 months ago" for a past timestamp. */
export function formatAgo(timestamp: string, locale: string, now: Date = new Date()): string {
  const days = Math.max(0, Math.round((now.getTime() - new Date(timestamp).getTime()) / DAY_MS));
  const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (days < 7) return format.format(-days, 'day');
  if (days < 60) return format.format(-Math.round(days / 7), 'week');
  return format.format(-Math.round(days / 30), 'month');
}
