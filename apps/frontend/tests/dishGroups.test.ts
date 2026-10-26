import { describe, expect, it } from 'vitest';

import { groupDishes, isPaused } from '@/lib/dishGroups';
import type { Dish } from '@/types/dish';

const dish = (id: string, overrides: Partial<Dish> = {}): Dish => ({
  id,
  name: id,
  imageUrl: null,
  pausedUntil: null,
  lastAddedAt: null,
  inList: false,
  ingredients: [],
  ...overrides,
});

const ids = (dishes: Dish[]) => dishes.map((d) => d.id);

describe('groupDishes', () => {
  it('sorts suggested dishes by rotation: never added first, then least recently added, then name', () => {
    const groups = groupDishes(
      [
        dish('Risotto', { lastAddedAt: '2026-10-01T10:00:00Z' }),
        dish('Minestrone'),
        dish('Curry', { lastAddedAt: '2026-09-01T10:00:00Z' }),
        dish('Farro'),
      ],
      '2026-10-26',
      'en',
    );
    expect(ids(groups.suggested)).toEqual(['Farro', 'Minestrone', 'Curry', 'Risotto']);
  });

  it('keeps in-list dishes out of Suggested and Paused, sorted by name', () => {
    const groups = groupDishes(
      [dish('Pizza', { inList: true }), dish('Lasagna', { inList: true, pausedUntil: '2026-12-01' })],
      '2026-10-26',
      'en',
    );
    expect(ids(groups.inList)).toEqual(['Lasagna', 'Pizza']);
    expect(groups.suggested).toEqual([]);
    expect(groups.paused).toEqual([]);
  });

  it('pauses until the date has passed, soonest to resume first', () => {
    const groups = groupDishes(
      [
        dish('Late', { pausedUntil: '2026-12-01' }),
        dish('Soon', { pausedUntil: '2026-11-01' }),
        dish('Today', { pausedUntil: '2026-10-26' }),
        dish('Over', { pausedUntil: '2026-10-01' }),
      ],
      '2026-10-26',
      'en',
    );
    expect(ids(groups.paused)).toEqual(['Soon', 'Late']);
    expect(ids(groups.suggested)).toEqual(['Over', 'Today']);
  });

  it('isPaused compares calendar dates', () => {
    expect(isPaused(dish('a', { pausedUntil: '2026-10-27' }), '2026-10-26')).toBe(true);
    expect(isPaused(dish('a', { pausedUntil: '2026-10-26' }), '2026-10-26')).toBe(false);
    expect(isPaused(dish('a'), '2026-10-26')).toBe(false);
  });
});
