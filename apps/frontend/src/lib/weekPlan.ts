import { foldText, rankByLabel } from '@/lib/itemSearch';
import type { Dish } from '@/types/dish';
import type { WeekMeal, WeekSlot } from '@/types/weekPlan';

export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;
export const MEALS: readonly WeekMeal[] = ['lunch', 'dinner'];
export const SLOT_COUNT = WEEKDAYS.length * MEALS.length;

export type WeekCell = { weekday: number; meal: WeekMeal; dish: Dish | null };
export type WeekDay = { weekday: number; cells: WeekCell[] };

/** The 7 days × 2 meals, each with its planned dish or `null`. */
export function buildWeek(slots: readonly WeekSlot[], dishes: readonly Dish[]): WeekDay[] {
  const byId = new Map(dishes.map((dish) => [dish.id, dish]));
  const planned = new Map(slots.map((slot) => [`${slot.weekday}.${slot.meal}`, slot.dishId]));
  return WEEKDAYS.map((weekday) => ({
    weekday,
    cells: MEALS.map((meal) => {
      const dishId = planned.get(`${weekday}.${meal}`);
      return { weekday, meal, dish: (dishId && byId.get(dishId)) || null };
    }),
  }));
}

export const plannedCount = (week: readonly WeekDay[]): number =>
  week.reduce((count, day) => count + day.cells.filter((cell) => cell.dish).length, 0);

/** The plan with one slot set to `dishId`, or emptied when it is null. */
export function withSlot(
  slots: readonly WeekSlot[],
  weekday: number,
  meal: WeekMeal,
  dishId: string | null,
): WeekSlot[] {
  const rest = slots.filter((slot) => slot.weekday !== weekday || slot.meal !== meal);
  return dishId ? [...rest, { weekday, meal, dishId }] : rest;
}

const weekdayFormats = new Map<string, Intl.DateTimeFormat>();

/** "Monday" for weekday 1, in the active locale, capitalised. */
export function weekdayName(weekday: number, locale: string): string {
  let format = weekdayFormats.get(locale);
  if (!format) {
    format = new Intl.DateTimeFormat(locale, { weekday: 'long' });
    weekdayFormats.set(locale, format);
  }
  // 1 January 2024 was a Monday.
  const name = format.format(new Date(2024, 0, weekday));
  return name.charAt(0).toLocaleUpperCase(locale) + name.slice(1);
}

/** Dishes by name, or the ones matching `query`, best match first. */
export function rankDishes(dishes: readonly Dish[], query: string, locale: string): Dish[] {
  if (!foldText(query)) return [...dishes].sort((a, b) => a.name.localeCompare(b.name, locale));
  return rankByLabel(dishes, query, (dish) => dish.name, locale);
}
