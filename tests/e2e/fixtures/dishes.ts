/*
 * API-only dish setup for specs whose subject is NOT the New dish form: they
 * create dishes (and put them on the list) over the API so the UI steps under
 * test stay short.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { RegisteredUser } from './auth';
import { api } from './lists';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173';

export type DishIngredientInput = { catalogItemKey: string } | { customName: string };

export async function createDishViaApi(
  user: RegisteredUser,
  shoppingListId: string,
  dish: { name: string; ingredients: DishIngredientInput[]; pausedUntil?: string },
): Promise<{ id: string }> {
  const { dish: created } = await api<{ dish: { id: string } }>(user.token, 'POST', `/lists/${shoppingListId}/dishes`, {
    name: dish.name,
    ingredients: dish.ingredients,
  });
  if (dish.pausedUntil) {
    await api(user.token, 'PATCH', `/lists/${shoppingListId}/dishes/${created.id}`, { pausedUntil: dish.pausedUntil });
  }
  return created;
}

export async function addDishToListViaApi(user: RegisteredUser, shoppingListId: string, dishId: string): Promise<void> {
  await api(user.token, 'POST', `/lists/${shoppingListId}/dishes/${dishId}/list`);
}

export async function addItemViaApi(user: RegisteredUser, shoppingListId: string, catalogItemKey: string): Promise<void> {
  await api(user.token, 'POST', `/lists/${shoppingListId}/items`, { catalogItemKey });
}

/** Marks every to-buy item with one of `catalogItemKeys` as bought. */
export async function buyItemsViaApi(user: RegisteredUser, shoppingListId: string, catalogItemKeys: string[]): Promise<void> {
  const { items } = await api<{ items: Array<{ id: string; catalogItemKey: string | null }> }>(
    user.token,
    'GET',
    `/lists/${shoppingListId}/items`,
  );
  for (const item of items.filter((i) => i.catalogItemKey && catalogItemKeys.includes(i.catalogItemKey))) {
    await api(user.token, 'PATCH', `/lists/${shoppingListId}/items/${item.id}`, { status: 'bought' });
  }
}

/** Uploads tests/e2e/fixtures/test-image.png as the dish photo. */
export async function uploadDishImageViaApi(user: RegisteredUser, shoppingListId: string, dishId: string): Promise<void> {
  const formData = new FormData();
  const png = readFileSync(resolve('tests/e2e/fixtures/test-image.png'));
  formData.append('image', new Blob([png], { type: 'image/png' }), 'dish.png');
  const response = await fetch(`${baseURL}/api/lists/${shoppingListId}/dishes/${dishId}/image`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${user.token}` },
    body: formData,
  });
  if (response.status !== 200) throw new Error(`dish image upload failed with ${response.status}`);
}
