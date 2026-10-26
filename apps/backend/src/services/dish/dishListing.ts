import { IsNull } from 'typeorm';

import { ensureListItem } from '../listItem/listItemMutations';
import { getShoppingListForMember } from '../shoppingList/shoppingListMembership';
import { findDish, serializeWithStatus } from './dishQueries';
import type { DishRepositories } from './dishRepositories';
import type { SerializedDish } from './dishSerialization';

/**
 * Puts every ingredient of the dish on the list and links each item to the
 * dish (ADR-0024). Items already to buy stay as they are, bought ones go back
 * to buy, and new ones get `source: 'dish'`. Records the add for rotation.
 */
export async function addDishToList(
  repositories: DishRepositories,
  shoppingListId: string,
  dishId: string,
  userId: string,
): Promise<SerializedDish> {
  await getShoppingListForMember(repositories, shoppingListId, userId);
  const dish = await findDish(repositories, shoppingListId, dishId);

  for (const ingredient of dish.ingredients) {
    const { item } = await ensureListItem(
      repositories,
      shoppingListId,
      { catalogItemKey: ingredient.catalogItemKey, customItemId: ingredient.customItemId },
      'dish',
      userId,
    );
    await repositories.listItemDishRepository.save({
      listItemId: item.id,
      dishId: dish.id,
      fulfilledAt: null,
    });
  }

  dish.previousLastAddedAt = dish.lastAddedAt;
  dish.lastAddedAt = new Date();
  await repositories.dishRepository.update(
    { id: dish.id },
    { lastAddedAt: dish.lastAddedAt, previousLastAddedAt: dish.previousLastAddedAt },
  );
  return serializeWithStatus(repositories, dish);
}

/**
 * Undoes an add: drops the dish's open links, then removes each linked item
 * that the dish put there, is still to buy, and no other dish still needs.
 * Items a member added by hand stay. Restores the previous add date.
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
    if (stillNeeded === 0) {
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
