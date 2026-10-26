import { IsNull } from 'typeorm';

import { ensureListItem, isUniqueViolation } from '../listItem/listItemMutations';
import { getShoppingListForMember } from '../shoppingList/shoppingListMembership';
import { findDish, getDishIdsInList, serializeWithStatus } from './dishQueries';
import type { DishRepositories } from './dishRepositories';
import type { SerializedDish } from './dishSerialization';

/** Opens a link from the item to the dish, unless one is already open. */
async function openLink(
  repositories: DishRepositories,
  listItemId: string,
  dishId: string,
): Promise<void> {
  const open = await repositories.listItemDishRepository.exists({
    where: { listItemId, dishId, fulfilledAt: IsNull() },
  });
  if (open) return;
  try {
    await repositories.listItemDishRepository.insert({ listItemId, dishId, fulfilledAt: null });
  } catch (error: unknown) {
    if (!isUniqueViolation(error)) throw error;
  }
}

/**
 * Puts every ingredient of the dish on the list and opens a link from each
 * item to the dish (ADR-0024). Items already to buy stay as they are, bought
 * ones go back to buy as dish items, and new ones get `source: 'dish'`.
 * Fulfilled links are kept as purchase history. Records the add for
 * rotation, unless the dish was already in the list.
 */
export async function addDishToList(
  repositories: DishRepositories,
  shoppingListId: string,
  dishId: string,
  userId: string,
): Promise<SerializedDish> {
  await getShoppingListForMember(repositories, shoppingListId, userId);
  const dish = await findDish(repositories, shoppingListId, dishId);
  const wasInList = (await getDishIdsInList(repositories, [dish.id])).has(dish.id);

  for (const ingredient of dish.ingredients) {
    const { item } = await ensureListItem(
      repositories,
      shoppingListId,
      { catalogItemKey: ingredient.catalogItemKey, customItemId: ingredient.customItemId },
      'dish',
      userId,
    );
    await openLink(repositories, item.id, dish.id);
  }

  if (!wasInList) {
    // Conditional on the date read above, so a concurrent add bumps it once.
    const addedAt = new Date();
    const result = await repositories.dishRepository.update(
      { id: dish.id, lastAddedAt: dish.lastAddedAt ?? IsNull() },
      { lastAddedAt: addedAt, previousLastAddedAt: dish.lastAddedAt },
    );
    if (result.affected) {
      dish.previousLastAddedAt = dish.lastAddedAt;
      dish.lastAddedAt = addedAt;
    } else {
      const current = await repositories.dishRepository.findOneByOrFail({ id: dish.id });
      dish.lastAddedAt = current.lastAddedAt;
      dish.previousLastAddedAt = current.previousLastAddedAt;
    }
  }
  return serializeWithStatus(repositories, dish);
}

/**
 * Undoes an add: drops the dish's open links, then removes each linked item
 * that is to buy because of a dish (`source: 'dish'`) and that no other dish
 * still needs; one bought before goes back to bought. Items a member added or
 * claimed by hand stay. Restores the previous add date.
 */
export async function removeDishFromList(
  repositories: DishRepositories,
  shoppingListId: string,
  dishId: string,
  userId: string,
): Promise<SerializedDish> {
  await getShoppingListForMember(repositories, shoppingListId, userId);
  const dish = await findDish(repositories, shoppingListId, dishId);

  const openLinks = await repositories.listItemDishRepository.find({
    where: { dishId: dish.id, fulfilledAt: IsNull() },
    relations: { listItem: true },
  });
  if (openLinks.length === 0) return serializeWithStatus(repositories, dish);

  await repositories.listItemDishRepository.delete({ dishId: dish.id, fulfilledAt: IsNull() });

  for (const { listItem } of openLinks) {
    if (!listItem || listItem.status !== 'to_buy' || listItem.source !== 'dish') continue;
    const stillNeeded = await repositories.listItemDishRepository.count({
      where: { listItemId: listItem.id, fulfilledAt: IsNull() },
    });
    if (stillNeeded > 0) continue;
    if (listItem.lastBoughtAt) {
      // The dish put a bought item back: return it to Last used.
      await repositories.listItemRepository.update({ id: listItem.id }, { status: 'bought' });
    } else {
      await repositories.listItemRepository.delete({ id: listItem.id, shoppingListId });
    }
  }

  dish.lastAddedAt = dish.previousLastAddedAt;
  dish.previousLastAddedAt = null;
  await repositories.dishRepository.update(
    { id: dish.id },
    { lastAddedAt: dish.lastAddedAt, previousLastAddedAt: null },
  );
  return serializeWithStatus(repositories, dish);
}
