import {
  resolveReference,
  type AddListItemInput,
  type ItemReference,
} from '../listItem/listItemMutations';
import { getShoppingListForMember } from '../shoppingList/shoppingListMembership';
import { findDish, serializeWithStatus } from './dishQueries';
import type { DishRepositories, DishTables } from './dishRepositories';
import type { SerializedDish } from './dishSerialization';

/** A dish as the form sends it: a name and at least one ingredient. */
export type DishInput = { name: string; ingredients: AddListItemInput[] };

const referenceKey = (reference: ItemReference) =>
  reference.catalogItemKey ? `catalog:${reference.catalogItemKey}` : `custom:${reference.customItemId}`;

/**
 * Resolves every ingredient (creating custom items as needed) outside the
 * write transaction, and drops repeats, keeping the first position.
 */
async function resolveIngredients(
  repositories: DishRepositories,
  shoppingListId: string,
  inputs: AddListItemInput[],
  userId: string,
): Promise<ItemReference[]> {
  const references = new Map<string, ItemReference>();
  for (const input of inputs) {
    const reference = await resolveReference(repositories, shoppingListId, input, userId);
    if (!references.has(referenceKey(reference))) references.set(referenceKey(reference), reference);
  }
  return [...references.values()];
}

async function writeIngredients(tables: DishTables, dishId: string, references: ItemReference[]) {
  await tables.dishIngredientRepository.delete({ dishId });
  await tables.dishIngredientRepository.save(
    references.map((reference, position) =>
      tables.dishIngredientRepository.create({ dishId, ...reference, position }),
    ),
  );
}

export async function createDish(
  repositories: DishRepositories,
  shoppingListId: string,
  input: DishInput,
  userId: string,
): Promise<SerializedDish> {
  await getShoppingListForMember(repositories, shoppingListId, userId);
  const references = await resolveIngredients(repositories, shoppingListId, input.ingredients, userId);

  const dishId = await repositories.transaction(async (tables) => {
    const dish = await tables.dishRepository.save(
      tables.dishRepository.create({ shoppingListId, name: input.name, createdById: userId }),
    );
    await writeIngredients(tables, dish.id, references);
    return dish.id;
  });

  return serializeWithStatus(repositories, await findDish(repositories, shoppingListId, dishId));
}

/**
 * Replaces the name and ingredients. The list is not touched: new
 * ingredients go on it the next time the dish is added (ADR-0024).
 */
export async function updateDish(
  repositories: DishRepositories,
  shoppingListId: string,
  dishId: string,
  input: DishInput,
  userId: string,
): Promise<SerializedDish> {
  await getShoppingListForMember(repositories, shoppingListId, userId);
  const dish = await findDish(repositories, shoppingListId, dishId);
  const references = await resolveIngredients(repositories, shoppingListId, input.ingredients, userId);

  await repositories.transaction(async (tables) => {
    await tables.dishRepository.update({ id: dish.id }, { name: input.name });
    await writeIngredients(tables, dish.id, references);
  });

  return serializeWithStatus(repositories, await findDish(repositories, shoppingListId, dishId));
}

/** Pauses the dish until `pausedUntil` (`YYYY-MM-DD`), or resumes it with `null`. */
export async function setDishPause(
  repositories: DishRepositories,
  shoppingListId: string,
  dishId: string,
  pausedUntil: string | null,
  userId: string,
): Promise<SerializedDish> {
  await getShoppingListForMember(repositories, shoppingListId, userId);
  const dish = await findDish(repositories, shoppingListId, dishId);
  dish.pausedUntil = pausedUntil;
  await repositories.dishRepository.update({ id: dish.id }, { pausedUntil });
  return serializeWithStatus(repositories, dish);
}

export async function setDishImage(
  repositories: DishRepositories,
  shoppingListId: string,
  dishId: string,
  imageUrl: string,
  userId: string,
): Promise<SerializedDish> {
  await getShoppingListForMember(repositories, shoppingListId, userId);
  const dish = await findDish(repositories, shoppingListId, dishId);
  dish.imageUrl = imageUrl;
  await repositories.dishRepository.update({ id: dish.id }, { imageUrl });
  return serializeWithStatus(repositories, dish);
}

/** Deletes the dish and its links; the items it put on the list stay there. */
export async function deleteDish(
  repositories: DishRepositories,
  shoppingListId: string,
  dishId: string,
  userId: string,
): Promise<void> {
  await getShoppingListForMember(repositories, shoppingListId, userId);
  const result = await repositories.dishRepository.delete({ id: dishId, shoppingListId });
  if (!result.affected) throw new Error('Dish not found.');
}
