import { WEEK_MEALS, type WeekMeal } from '../../entities/WeekSlot';
import type { WeekSlotInput } from '../../services/weekPlanService';

type Parsed<T> = { ok: true; value: T } | { ok: false; message: string };
type Slot = { weekday: number; meal: WeekMeal };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLOTS_MAX = 7 * WEEK_MEALS.length;

const parseSlotKey = (body: Record<string, unknown>): Parsed<Slot> => {
  const { weekday, meal } = body;
  if (typeof weekday !== 'number' || !Number.isInteger(weekday) || weekday < 1 || weekday > 7) {
    return { ok: false, message: 'weekday must be an integer from 1 (Monday) to 7 (Sunday).' };
  }
  if (typeof meal !== 'string' || !(WEEK_MEALS as readonly string[]).includes(meal)) {
    return { ok: false, message: 'meal must be lunch or dinner.' };
  }
  return { ok: true, value: { weekday, meal: meal as WeekMeal } };
};

const isDishId = (value: unknown): value is string =>
  typeof value === 'string' && UUID_PATTERN.test(value);

/** `{ weekday, meal, dishId }`; a null `dishId` empties the slot. */
export function parseSlotBody(
  body: unknown,
): Parsed<Slot & { dishId: string | null }> {
  const record = (body ?? {}) as Record<string, unknown>;
  const key = parseSlotKey(record);
  if (!key.ok) return key;
  const { dishId } = record;
  if (dishId !== null && !isDishId(dishId)) {
    return { ok: false, message: 'dishId must be a dish id or null.' };
  }
  return { ok: true, value: { ...key.value, dishId } };
}

/** `{ slots: [{ weekday, meal, dishId }] }`, each slot at most once. */
export function parsePlanBody(body: unknown): Parsed<WeekSlotInput[]> {
  const { slots } = (body ?? {}) as { slots?: unknown };
  if (!Array.isArray(slots) || slots.length > SLOTS_MAX) {
    return { ok: false, message: `slots must be an array of at most ${SLOTS_MAX} slots.` };
  }
  const seen = new Set<string>();
  const parsed: WeekSlotInput[] = [];
  for (const slot of slots) {
    const record = (slot ?? {}) as Record<string, unknown>;
    const key = parseSlotKey(record);
    if (!key.ok) return key;
    if (!isDishId(record.dishId)) return { ok: false, message: 'Every slot needs a dishId.' };
    const id = `${key.value.weekday}.${key.value.meal}`;
    if (seen.has(id)) return { ok: false, message: 'A slot appears more than once.' };
    seen.add(id);
    parsed.push({ ...key.value, dishId: record.dishId });
  }
  return { ok: true, value: parsed };
}
