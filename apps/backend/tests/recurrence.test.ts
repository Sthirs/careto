/**
 * Unit tests for the habit derivation (ADR-0027): pure functions over a
 * product's events, so no repositories are involved.
 */
import { describe, expect, it } from 'vitest';

import {
  deriveHabit,
  isDue,
  medianInterval,
  snoozeDays,
  type HabitEvent,
} from '../src/services/listItem/recurrence';

const START = new Date('2026-09-01T10:00:00Z').getTime();
const DAY_MS = 24 * 60 * 60 * 1000;
const day = (n: number) => new Date(START + n * DAY_MS);
const ev = (kind: HabitEvent['kind'], source: HabitEvent['source'], at: number): HabitEvent => ({
  kind,
  source,
  at: day(at),
});
/** A hand add on `addAt`, then its buy on `boughtAt`. */
const handCycle = (addAt: number, boughtAt: number): HabitEvent[] => [
  ev('added', 'user', addAt),
  ev('bought', 'user', boughtAt),
];

describe('medianInterval', () => {
  it('needs at least two samples', () => {
    expect(medianInterval([])).toBeNull();
    expect(medianInterval([7])).toBeNull();
  });

  it('takes the median, rounded, of the last eight samples only', () => {
    expect(medianInterval([6, 9, 7])).toBe(7);
    expect(medianInterval([6, 9])).toBe(8);
    expect(medianInterval([30, 30, 30, 2, 2, 2, 2, 3, 3, 3, 3])).toBe(3);
  });
});

describe('snoozeDays', () => {
  it('is a quarter of the interval, at least one day', () => {
    expect(snoozeDays(null)).toBe(1);
    expect(snoozeDays(2)).toBe(1);
    expect(snoozeDays(8)).toBe(2);
    expect(snoozeDays(30)).toBe(8);
  });
});

describe('deriveHabit', () => {
  it('has no habit before a first purchase', () => {
    expect(deriveHabit([ev('added', 'user', 0)])).toEqual({
      lastPurchaseAt: null,
      samples: [],
      intervalDays: null,
      snoozedUntil: null,
    });
  });

  it('measures from a purchase to the next hand add, once that add is bought', () => {
    const habit = deriveHabit([
      ...handCycle(0, 1),
      ...handCycle(8, 9),
      ...handCycle(15, 18),
    ]);
    expect(habit.samples).toEqual([7, 6]);
    expect(habit.intervalDays).toBe(7);
    expect(habit.lastPurchaseAt).toEqual(day(18));
  });

  it('commits nothing for a hand add that is not bought yet', () => {
    const habit = deriveHabit([...handCycle(0, 1), ev('added', 'user', 8)]);
    expect(habit.samples).toEqual([]);
  });

  it('measures from the first hand add of a period only', () => {
    const habit = deriveHabit([...handCycle(0, 1), ev('added', 'user', 5), ...handCycle(7, 9)]);
    expect(habit.samples).toEqual([4]);
  });

  it('ignores everything bought for a dish', () => {
    const habit = deriveHabit([
      ...handCycle(0, 1),
      ev('added', 'dish', 3),
      ev('bought', 'dish', 4),
      ev('removed', 'dish', 5),
      ...handCycle(8, 9),
    ]);
    expect(habit.samples).toEqual([7]);
    expect(habit.snoozedUntil).toBeNull();
  });

  it('cancels a mistaken tap and the buy it undid', () => {
    const habit = deriveHabit([
      ...handCycle(0, 1),
      ev('added', 'user', 8),
      ev('bought', 'user', 8.5),
      ev('unbought', 'user', 8.5),
      ev('bought', 'user', 10),
    ]);
    expect(habit.samples).toEqual([7]);
    expect(habit.lastPurchaseAt).toEqual(day(10));
  });

  it('measures nothing from a purchase the system proposed', () => {
    const habit = deriveHabit([
      ...handCycle(0, 1),
      ...handCycle(8, 9),
      ...handCycle(16, 17),
      ev('added', 'recurring', 24),
      ev('bought', 'recurring', 25),
    ]);
    expect(habit.samples).toEqual([7, 7]);
    expect(habit.lastPurchaseAt).toEqual(day(25));
  });

  it('turns a removal into a "not finished yet" lower bound plus its snooze', () => {
    const habit = deriveHabit([
      ...handCycle(0, 1),
      ...handCycle(8, 9),
      ...handCycle(16, 17),
      ev('added', 'recurring', 24),
      ev('removed', 'recurring', 24),
      ev('added', 'recurring', 26),
      ev('bought', 'recurring', 27),
    ]);
    // 7 days to the removal, plus the 2-day snooze of a 7-day interval.
    expect(habit.samples).toEqual([7, 7, 9]);
    expect(habit.snoozedUntil).toBeNull();
  });

  it('snoozes the product from the last "not finished yet" removal', () => {
    const habit = deriveHabit([
      ...handCycle(0, 1),
      ...handCycle(8, 9),
      ...handCycle(16, 17),
      ev('added', 'recurring', 24),
      ev('removed', 'recurring', 24),
    ]);
    expect(habit.snoozedUntil).toEqual(day(26));
  });

  it('cancels the exact sample of a hand add removed before it is bought', () => {
    const habit = deriveHabit([
      ...handCycle(0, 1),
      ev('added', 'user', 4),
      ev('removed', 'user', 4),
      ev('added', 'recurring', 9),
      ev('bought', 'recurring', 10),
    ]);
    // A lower bound of 3 days plus the 1-day snooze, never the 3-day exact add.
    expect(habit.samples).toEqual([4]);
  });

  it('prefers an exact sample to a lower bound in the same period', () => {
    const habit = deriveHabit([
      ...handCycle(0, 1),
      ev('added', 'user', 4),
      ev('removed', 'user', 4),
      ...handCycle(7, 8),
    ]);
    expect(habit.samples).toEqual([6]);
  });
});

describe('isDue', () => {
  const habit = deriveHabit([...handCycle(0, 1), ...handCycle(8, 9), ...handCycle(16, 17)]);

  it('is due once the interval has passed since the last purchase', () => {
    expect(isDue(habit, day(23.9))).toBe(false);
    expect(isDue(habit, day(24))).toBe(true);
  });

  it('is never due for a product that is not recurring yet', () => {
    expect(isDue(deriveHabit(handCycle(0, 1)), day(100))).toBe(false);
  });

  it('waits for the snooze of a "not finished yet" removal', () => {
    const snoozed = deriveHabit([
      ...handCycle(0, 1),
      ...handCycle(8, 9),
      ...handCycle(16, 17),
      ev('added', 'recurring', 24),
      ev('removed', 'recurring', 24),
    ]);
    expect(isDue(snoozed, day(25.9))).toBe(false);
    expect(isDue(snoozed, day(26))).toBe(true);
  });
});
