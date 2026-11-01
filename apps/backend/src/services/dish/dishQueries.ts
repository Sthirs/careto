import { In, IsNull } from 'typeorm';

import { Dish } from '../../entities/Dish';
import { loadOverrides } from '../listItem/itemOverrides';
import { getShoppingListForMember } from '../shoppingList/shoppingListMembership';
import type { DishRepositories } from './dishRepositories';
import { serializeDish, type SerializedDish } from './dishSerialization';

export const DISH_RELATIONS = {
  ingredients: { catalogItem: true, customItem: true },
} as const;

/**
 * The dishes, among `dishIds`, that are in the list: they have an open link
 * to an item that is still to buy (ADR-0024).
 */
export async function getDishIdsInList(
  repositories: DishRepositories,
  dishIds: string[],
): Promise<Set<string>> {
  if (dishIds.length === 0) return new Set();
  const links = await repositories.listItemDishRepository.find({
    where: { dishId: In(dishIds), fulfilledAt: IsNull() },
    relations: { listItem: true },
  });
  return new Set(
    links.filter((link) => link.listItem?.status === 'to_buy').map((link) => link.dishId),
  );
}

/** Loads one dish of the list, or throws a "not found" error. */
export async function findDish(
  repositories: DishRepositories,
  shoppingListId: string,
  dishId: string,
): Promise<Dish> {
  const dish = await repositories.dishRepository.findOne({
    where: { id: dishId, shoppingListId },
    relations: DISH_RELATIONS,
  });
  if (!dish) throw new Error('Dish not found.');
  return dish;
}

export async function serializeWithStatus(
  repositories: DishRepositories,
  dish: Dish,
): Promise<SerializedDish> {
  const inList = await getDishIdsInList(repositories, [dish.id]);
  const overrides = await loadOverrides(repositories.itemOverrideRepository, dish.shoppingListId);
  return serializeDish(dish, inList.has(dish.id), overrides);
}

export async function listDishes(
  repositories: DishRepositories,
  shoppingListId: string,
  userId: string,
): Promise<SerializedDish[]> {
  await getShoppingListForMember(repositories, shoppingListId, userId);
  const dishes = await repositories.dishRepository.find({
    where: { shoppingListId },
    relations: DISH_RELATIONS,
    order: { name: 'ASC' },
  });
  const inList = await getDishIdsInList(
    repositories,
    dishes.map((dish) => dish.id),
  );
  const overrides = await loadOverrides(repositories.itemOverrideRepository, shoppingListId);
  return dishes.map((dish) => serializeDish(dish, inList.has(dish.id), overrides));
}

export async function getDish(
  repositories: DishRepositories,
  shoppingListId: string,
  dishId: string,
  userId: string,
): Promise<SerializedDish> {
  await getShoppingListForMember(repositories, shoppingListId, userId);
  return serializeWithStatus(repositories, await findDish(repositories, shoppingListId, dishId));
}
