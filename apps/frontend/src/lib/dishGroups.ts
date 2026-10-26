import type { Dish } from '@/types/dish';

export type DishGroups = { inList: Dish[]; suggested: Dish[]; paused: Dish[] };

/** Paused while `pausedUntil` is after `todayIso` (both `YYYY-MM-DD`). */
export const isPaused = (dish: Dish, todayIso: string): boolean =>
  dish.pausedUntil !== null && dish.pausedUntil > todayIso;

/**
 * Splits the dishes into the three sections of the Dishes screen (ADR-0024):
 * - in the list, as the server derived it, by name;
 * - suggested: neither in the list nor paused, least recently added first
 *   (never-added on top), then by name — the rotation order;
 * - paused: soonest to resume first.
 */
export function groupDishes(dishes: Dish[], todayIso: string, locale: string): DishGroups {
  const byName = (a: Dish, b: Dish) => a.name.localeCompare(b.name, locale, { sensitivity: 'base' });

  const inList = dishes.filter((dish) => dish.inList).sort(byName);
  const paused = dishes
    .filter((dish) => !dish.inList && isPaused(dish, todayIso))
    .sort((a, b) => (a.pausedUntil as string).localeCompare(b.pausedUntil as string) || byName(a, b));
  const suggested = dishes
    .filter((dish) => !dish.inList && !isPaused(dish, todayIso))
    .sort((a, b) => {
      if (a.lastAddedAt !== b.lastAddedAt) {
        if (a.lastAddedAt === null) return -1;
        if (b.lastAddedAt === null) return 1;
        return a.lastAddedAt.localeCompare(b.lastAddedAt);
      }
      return byName(a, b);
    });

  return { inList, suggested, paused };
}
