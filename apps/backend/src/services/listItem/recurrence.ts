import type { ListItemSource } from '../../entities/ListItem';
import type { ListItemEventKind } from '../../entities/ListItemEvent';

/** What the derivation reads of an event (ADR-0027). */
export type HabitEvent = { kind: ListItemEventKind; source: ListItemSource; at: Date };

export type Habit = {
  /** The last purchase that restarted the stock: never one for a dish. */
  lastPurchaseAt: Date | null;
  /** Stock lifetimes in days, oldest first, one per measured stock period. */
  samples: number[];
  /** Median of the recent samples; null until the product is recurring. */
  intervalDays: number | null;
  /** A "not finished yet" removal holds the product back until its next purchase. */
  heldBack: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;
/** Samples a product needs before it counts as recurring. */
export const MIN_SAMPLES = 2;
/** Only the most recent samples set the interval, so habits can change. */
export const RECENT_SAMPLES = 8;

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
 * gives at most one sample: from the purchase to the first hand add that was
 * then bought. A hand add that claims the planner's proposal measures nothing,
 * and a "not finished yet" removal holds the product back until it is bought.
 */
export function deriveHabit(events: readonly HabitEvent[]): Habit {
  const samples: number[] = [];
  let lastPurchaseAt: Date | null = null;
  let handAddAt: Date | null = null;
  let proposed = false;
  let heldBack = false;

  for (const event of withoutUndoneBuys(events)) {
    // Dish consumption is not base consumption: it never measures the stock.
    if (event.source === 'dish') continue;

    if (event.kind === 'added' && event.source === 'recurring') {
      proposed = true;
    } else if (event.kind === 'added' && event.source === 'user') {
      if (lastPurchaseAt && !handAddAt && !proposed) handAddAt = event.at;
    } else if (event.kind === 'removed') {
      handAddAt = null;
      proposed = false;
      heldBack = true;
    } else if (event.kind === 'bought') {
      if (lastPurchaseAt && handAddAt) samples.push(wholeDays(lastPurchaseAt, handAddAt));
      lastPurchaseAt = event.at;
      handAddAt = null;
      proposed = false;
      heldBack = false;
    }
  }

  return { lastPurchaseAt, samples, intervalDays: medianInterval(samples), heldBack };
}

/**
 * A recurring product is due once its interval has passed since the last
 * purchase, unless a removal holds it back.
 */
export function isDue(habit: Habit, now: Date): boolean {
  if (habit.intervalDays === null || !habit.lastPurchaseAt || habit.heldBack) return false;
  return now >= addDays(habit.lastPurchaseAt, habit.intervalDays);
}
