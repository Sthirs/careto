import { describe, expect, it } from 'vitest';

import { buildWeek, plannedCount, rankDishes, weekdayName, withSlot } from '@/lib/weekPlan';
import type { Dish } from '@/types/dish';

const dish = (id: string, name = id): Dish => ({
  id,
  name,
  imageUrl: null,
  pausedUntil: null,
  lastAddedAt: null,
  inList: false,
  ingredients: [],
});

describe('week plan helpers', () => {
  it('builds Monday to Sunday with lunch and dinner, skipping unknown dishes', () => {
    const week = buildWeek(
      [
        { weekday: 1, meal: 'dinner', dishId: 'pasta' },
        { weekday: 7, meal: 'lunch', dishId: 'gone' },
      ],
      [dish('pasta')],
    );
    expect(week.map((day) => day.weekday)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(week[0].cells.map((cell) => [cell.meal, cell.dish?.id ?? null])).toEqual([
      ['lunch', null],
      ['dinner', 'pasta'],
    ]);
    expect(week[6].cells[0].dish).toBeNull();
    expect(plannedCount(week)).toBe(1);
  });

  it('sets, replaces and empties one slot', () => {
    const one = withSlot([], 2, 'lunch', 'a');
    expect(one).toEqual([{ weekday: 2, meal: 'lunch', dishId: 'a' }]);
    expect(withSlot(one, 2, 'lunch', 'b')).toEqual([{ weekday: 2, meal: 'lunch', dishId: 'b' }]);
    expect(withSlot(one, 2, 'lunch', null)).toEqual([]);
  });

  it('names weekdays in the active locale, capitalised', () => {
    expect(weekdayName(1, 'en')).toBe('Monday');
    expect(weekdayName(7, 'it')).toBe('Domenica');
  });

  it('sorts dishes by name, and best matches first when searching', () => {
    const dishes = [dish('1', 'Pollo al limone'), dish('2', 'Minestrone'), dish('3', 'Pasta al pomodoro')];
    expect(rankDishes(dishes, '', 'en').map((d) => d.name)).toEqual([
      'Minestrone',
      'Pasta al pomodoro',
      'Pollo al limone',
    ]);
    expect(rankDishes(dishes, 'po', 'en').map((d) => d.name)).toEqual(['Pollo al limone', 'Pasta al pomodoro']);
    expect(rankDishes(dishes, 'curry', 'en')).toEqual([]);
  });
});
