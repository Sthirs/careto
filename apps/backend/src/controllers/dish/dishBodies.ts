import { DISH_NAME_MAX_LENGTH } from '../../entities/Dish';
import type { DishInput } from '../../services/dishService';
import type { AddListItemInput } from '../../services/listItemService';
import { parseAddItemBody } from '../listItem/listItemBodies';

type Parsed<T> = { ok: true; value: T } | { ok: false; message: string };

export const DISH_INGREDIENTS_MAX = 100;

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** A real calendar date in `YYYY-MM-DD` form (rejects `2026-02-30`). */
const isIsoDate = (value: string): boolean => {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

/**
 * Whitelist parse of the dish create/replace body (ADR-0010 discipline):
 * a 1-80 character name and 1-100 ingredients, each shaped like the body of
 * `POST /lists/:id/items`.
 */
export function parseDishBody(body: unknown): Parsed<DishInput> {
  const { name, ingredients } = (body ?? {}) as Record<string, unknown>;

  const trimmed = typeof name === 'string' ? name.trim().replace(/\s+/g, ' ') : '';
  if (trimmed.length === 0 || trimmed.length > DISH_NAME_MAX_LENGTH) {
    return { ok: false, message: `name must be 1-${DISH_NAME_MAX_LENGTH} characters.` };
  }

  if (!Array.isArray(ingredients) || ingredients.length === 0) {
    return { ok: false, message: 'ingredients must hold at least one ingredient.' };
  }
  if (ingredients.length > DISH_INGREDIENTS_MAX) {
    return { ok: false, message: `ingredients can hold at most ${DISH_INGREDIENTS_MAX} ingredients.` };
  }

  const parsedIngredients: AddListItemInput[] = [];
  for (const ingredient of ingredients) {
    const parsed = parseAddItemBody(ingredient);
    if (!parsed.ok) return { ok: false, message: `Invalid ingredient: ${parsed.message}` };
    parsedIngredients.push(parsed.value);
  }

  return { ok: true, value: { name: trimmed, ingredients: parsedIngredients } };
}

/** `{ pausedUntil: 'YYYY-MM-DD' }` pauses, `{ pausedUntil: null }` resumes. */
export function parsePauseBody(body: unknown): Parsed<string | null> {
  const { pausedUntil } = (body ?? {}) as { pausedUntil?: unknown };
  if (pausedUntil === null) return { ok: true, value: null };
  return typeof pausedUntil === 'string' && isIsoDate(pausedUntil)
    ? { ok: true, value: pausedUntil }
    : { ok: false, message: 'pausedUntil must be a YYYY-MM-DD date or null.' };
}
