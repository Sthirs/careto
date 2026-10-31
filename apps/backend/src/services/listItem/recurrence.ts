import type { ListItemSource } from '../../entities/ListItem';
import type { ListItemEventKind } from '../../entities/ListItemEvent';

/** What the derivation reads of an event (ADR-0027). */
export type HabitEvent = { kind: ListItemEventKind; source: ListItemSource; at: Date };

export type Habit = {
  /** The last purchase that restarted the stock: never one for a dish. */
  lastPurchaseAt: Date | null;
  /** Stock lifetimes in days, oldest first, one per closed stock period. */
  samples: number[];
  /** Median of the recent samples; null until the product is recurring. */
  intervalDays: number | null;
  /** A "not finished yet" removal holds the product back until then. */
  snoozedUntil: Date | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;
/** Samples a product needs before it counts as recurring. */
export const MIN_SAMPLES = 2;
/** Only the most recent samples set the interval, so habits can change. */
export const RECENT_SAMPLES = 8;
/** Share of the interval a "not finished yet" removal waits before re-proposing. */
const SNOOZE_SHARE = 0.25;

const wholeDays = (from: Date, to: Date): number =>
  Math.max(1, Math.round((to.getTime() - from.getTime()) / DAY_MS));

const addDays = (date: Date, days: number): Date => new Date(date.getTime() + days * DAY_MS);

/** The median of the recent samples in whole days, or null below the minimum. */
export function medianInterval(samples: readonly number[]): number | null {
  if (samples.length < MIN_SAMPLES) return null;
  const sorted = samples.slice(-RECENT_SAMPLES).sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  return Math.max(1, Math.round(median));
}

/** How long a "not finished yet" removal holds the product back, in days. */
export const snoozeDays = (intervalDays: number | null): number =>
  Math.max(1, Math.round((intervalDays ?? 0) * SNOOZE_SHARE));

/** Drops every undone mistaken tap: each `unbought` and the buy it undid. */
function withoutUndoneBuys(events: readonly HabitEvent[]): HabitEvent[] {
  const kept: HabitEvent[] = [];
  for (const event of events) {
    if (event.kind !== 'unbought') {
      kept.push(event);
      continue;
    }
    const undone = kept.map((e) => e.kind).lastIndexOf('bought');
    if (undone >= 0) kept.splice(undone, 1);
  }
  return kept;
}

/**
 * Derives a product's habit from its events, in time order (ADR-0027). A
 * stock period runs from one purchase not made for a dish to the next, and
 * gives at most one sample: exact, from the purchase to the first hand add
 * that was then bought; otherwise a lower bound, from the purchase to the
 * last "not finished yet" removal, plus the snooze it caused.
 */
export function deriveHabit(events: readonly HabitEvent[]): Habit {
  const samples: number[] = [];
  let lastPurchaseAt: Date | null = null;
  let handAddAt: Date | null = null;
  let notFinished: { at: Date; snooze: number } | null = null;

  for (const event of withoutUndoneBuys(events)) {
    // Dish consumption is not base consumption: it never measures the stock.
    if (event.source === 'dish') continue;

    if (event.kind === 'added' && event.source === 'user') {
      if (lastPurchaseAt && !handAddAt) handAddAt = event.at;
    } else if (event.kind === 'removed') {
      handAddAt = null;
      if (lastPurchaseAt) {
        notFinished = { at: event.at, snooze: snoozeDays(medianInterval(samples)) };
      }
    } else if (event.kind === 'bought') {
      if (lastPurchaseAt && handAddAt) {
        samples.push(wholeDays(lastPurchaseAt, handAddAt));
      } else if (lastPurchaseAt && notFinished) {
        samples.push(wholeDays(lastPurchaseAt, notFinished.at) + notFinished.snooze);
      }
      lastPurchaseAt = event.at;
      handAddAt = null;
      notFinished = null;
    }
  }

  return {
    lastPurchaseAt,
    samples,
    intervalDays: medianInterval(samples),
    snoozedUntil: notFinished ? addDays(notFinished.at, notFinished.snooze) : null,
  };
}

/** A recurring product is due once its interval has passed since the last purchase. */
export function isDue(habit: Habit, now: Date): boolean {
  if (habit.intervalDays === null || !habit.lastPurchaseAt) return false;
  if (habit.snoozedUntil && now < habit.snoozedUntil) return false;
  return now >= addDays(habit.lastPurchaseAt, habit.intervalDays);
}
