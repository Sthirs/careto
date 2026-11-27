import type { Request } from 'express';

/** The header an offline change carries: when the member really tapped (ADR-0030). */
export const OCCURRED_AT_HEADER = 'x-occurred-at';

/** How far back a synced change may be dated; anything older is "now". */
export const OCCURRED_AT_MAX_AGE_MS = 7 * 24 * 60 * 60_000;

const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

/** `Date` rolls `2026-02-30` over to March 2; such a date is no real tap. */
const isRealCalendarDate = (header: string): boolean => {
  const [year, month, day] = header.slice(0, 10).split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
};

/**
 * When the change happened: the `X-Occurred-At` ISO time an offline client
 * sends with a change it syncs later, or `now`. A missing, malformed, future
 * or more than seven days old value means `now`, so a wrong client clock can
 * never date a change ahead of the server or far into the past.
 */
export function parseOccurredAt(header: unknown, now: Date = new Date()): Date {
  if (typeof header !== 'string' || !ISO_DATE_TIME.test(header)) return now;
  if (!isRealCalendarDate(header)) return now;
  const at = new Date(header);
  const time = at.getTime();
  if (Number.isNaN(time) || time > now.getTime()) return now;
  if (now.getTime() - time > OCCURRED_AT_MAX_AGE_MS) return now;
  return at;
}

export const occurredAtOf = (request: Request): Date =>
  parseOccurredAt(request.get(OCCURRED_AT_HEADER));
