import type { OutboxOp } from './outboxOps';

/**
 * How long a change may wait to sync (ADR-0031). Offline is meant to last
 * minutes or hours; an older change is dropped and the list reloads instead.
 * Measured on the phone's own clock, so a skewed clock does not matter.
 */
export const OUTBOX_MAX_AGE_MS = 60 * 60_000;

/**
 * How many server errors (a 5xx or a 429 the server answered) one change may
 * get before it is dropped as refused, so one failing change never blocks the
 * changes behind it. About four minutes with the retry backoff. A request
 * with no answer at all counts only against `OUTBOX_MAX_AGE_MS`.
 */
export const MAX_SERVER_ERRORS = 10;

export const isExpired = (op: OutboxOp, now: number = Date.now()): boolean => {
  const at = Date.parse(op.occurredAt);
  return Number.isNaN(at) || now - at > OUTBOX_MAX_AGE_MS;
};

/** Answered server errors per op id, kept in memory: a reload starts over. */
const serverErrors = new Map<string, number>();

/** Counts one answered server error of `op`; true once it reached the limit. */
export function countServerError(op: OutboxOp): boolean {
  const count = (serverErrors.get(op.id) ?? 0) + 1;
  serverErrors.set(op.id, count);
  return count >= MAX_SERVER_ERRORS;
}

export const forgetServerErrors = (opId?: string): void => {
  if (opId === undefined) serverErrors.clear();
  else serverErrors.delete(opId);
};
