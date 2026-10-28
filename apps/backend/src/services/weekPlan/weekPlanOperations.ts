import { In } from 'typeorm';

import type { WeekMeal } from '../../entities/WeekSlot';
import { addDishToList } from '../dish/dishListing';
import { getShoppingListForMember } from '../shoppingList/shoppingListMembership';
import type { WeekPlanRepositories } from './weekPlanRepositories';

export type WeekSlotInput = { weekday: number; meal: WeekMeal; dishId: string };
export type SerializedWeekPlan = { slots: WeekSlotInput[] };

const MEAL_ORDER: Record<WeekMeal, number> = { lunch: 0, dinner: 1 };

/** The planned slots of the list, Monday lunch first. */
export async function getPlan(
  repositories: WeekPlanRepositories,
  shoppingListId: string,
  userId: string,
): Promise<SerializedWeekPlan> {
  await getShoppingListForMember(repositories, shoppingListId, userId);
  const rows = await repositories.weekSlotRepository.find({ where: { shoppingListId } });
  const slots = rows
    .map(({ weekday, meal, dishId }) => ({ weekday, meal, dishId }))
    .sort((a, b) => a.weekday - b.weekday || MEAL_ORDER[a.meal] - MEAL_ORDER[b.meal]);
  return { slots };
}

/** Throws unless every dish id names a dish of the list. */
async function assertDishesOfList(
  repositories: WeekPlanRepositories,
  shoppingListId: string,
  dishIds: string[],
): Promise<void> {
  const unique = [...new Set(dishIds)];
  if (unique.length === 0) return;
  const found = await repositories.dishRepository.count({
    where: { id: In(unique), shoppingListId },
  });
  if (found !== unique.length) throw new Error('Dish not found.');
}

/** Puts a dish in one slot, or empties it when `dishId` is null. */
export async function setSlot(
  repositories: WeekPlanRepositories,
  shoppingListId: string,
  slot: { weekday: number; meal: WeekMeal; dishId: string | null },
  userId: string,
): Promise<SerializedWeekPlan> {
  await getShoppingListForMember(repositories, shoppingListId, userId);
  const { weekday, meal, dishId } = slot;
  if (dishId === null) {
    await repositories.weekSlotRepository.delete({ shoppingListId, weekday, meal });
  } else {
    await assertDishesOfList(repositories, shoppingListId, [dishId]);
    await repositories.weekSlotRepository.upsert(
      { shoppingListId, weekday, meal, dishId },
      { conflictPaths: ['shoppingListId', 'weekday', 'meal'] },
    );
  }
  return getPlan(repositories, shoppingListId, userId);
}

/** Replaces the whole plan: `[]` starts a new plan, the old slots undo it. */
export async function replacePlan(
  repositories: WeekPlanRepositories,
  shoppingListId: string,
  slots: WeekSlotInput[],
  userId: string,
): Promise<SerializedWeekPlan> {
  await getShoppingListForMember(repositories, shoppingListId, userId);
  await assertDishesOfList(
    repositories,
    shoppingListId,
    slots.map((slot) => slot.dishId),
  );
  await repositories.replaceSlots(async (table) => {
    await table.delete({ shoppingListId });
    if (slots.length > 0) {
      await table.insert(slots.map((slot) => ({ ...slot, shoppingListId })));
    }
  });
  return getPlan(repositories, shoppingListId, userId);
}

/**
 * Adds every planned dish to the list through the dish service (ADR-0024),
 * once per dish. Dishes already in the list stay as they are.
 */
export async function addPlanToList(
  repositories: WeekPlanRepositories,
  shoppingListId: string,
  userId: string,
): Promise<void> {
  const { slots } = await getPlan(repositories, shoppingListId, userId);
  for (const dishId of new Set(slots.map((slot) => slot.dishId))) {
    await addDishToList(repositories, shoppingListId, dishId, userId);
  }
}
