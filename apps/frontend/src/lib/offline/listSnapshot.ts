import type { AuthUser } from '@/types/auth';
import type { Catalog, ListItemsResponse } from '@/types/listItem';
import type { ShoppingListDetail } from '@/types/shoppingList';

import { readJson, removeKey, removeKeysWithPrefix, writeJson } from './storage';

/**
 * On-device copies of what the list screen last loaded (ADR-0030). They are
 * read only when the network fails, so the list opens offline, also after
 * the app was reloaded. Keyed by user, so a shared device never shows another
 * account's list. Images are dropped: they are data URLs (ADR-0015) and the
 * list screen does not need them.
 */
export type ListSnapshot = {
  shoppingList?: ShoppingListDetail;
  items?: ListItemsResponse;
};

const userPrefix = (userId: string) => `careto.offline.${userId}.`;
const listKey = (userId: string, listId: string) => `${userPrefix(userId)}list.${listId}`;
const CATALOG_KEY = 'careto.offline.catalog';
const USER_KEY = 'careto.offline.user';

/*
 * A stored copy is only valid JSON, not a checked shape: an old or damaged
 * copy reads as "no copy", so the caller keeps its network error.
 */
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isListSnapshot = (value: unknown): value is ListSnapshot => {
  if (!isObject(value)) return false;
  const { items, shoppingList } = value;
  if (shoppingList !== undefined && !(isObject(shoppingList) && Array.isArray(shoppingList.members))) {
    return false;
  }
  return (
    items === undefined ||
    (isObject(items) &&
      Array.isArray(items.items) &&
      Array.isArray(items.customItems) &&
      Array.isArray(items.sectionOrder))
  );
};

const isCatalog = (value: unknown): value is Catalog =>
  isObject(value) && Array.isArray(value.sections) && Array.isArray(value.items);

const isAuthUser = (value: unknown): value is AuthUser =>
  isObject(value) && typeof value.id === 'string';

const readChecked = <T>(key: string, isValid: (value: unknown) => value is T): T | null => {
  const value = readJson<unknown>(key);
  return isValid(value) ? value : null;
};

export const readListSnapshot = (userId: string, listId: string): ListSnapshot | null =>
  readChecked(listKey(userId, listId), isListSnapshot);

const withoutImages = (detail: ShoppingListDetail): ShoppingListDetail => ({
  ...detail,
  imageUrl: null,
  members: detail.members.map((member) => ({ ...member, imageUrl: null })),
});

export function saveListSnapshot(userId: string, listId: string, patch: ListSnapshot): void {
  const current = readListSnapshot(userId, listId) ?? {};
  writeJson(listKey(userId, listId), {
    ...current,
    ...patch,
    ...(patch.shoppingList ? { shoppingList: withoutImages(patch.shoppingList) } : {}),
  });
}

export const clearListSnapshots = (userId: string): void =>
  removeKeysWithPrefix(userPrefix(userId));

export const readCatalogSnapshot = (): Catalog | null => readChecked(CATALOG_KEY, isCatalog);

export const saveCatalogSnapshot = (catalog: Catalog): void => {
  writeJson(CATALOG_KEY, catalog);
};

/** The signed-in user, so the router guard knows who it is on an offline start. */
export const readUserSnapshot = (): AuthUser | null => readChecked(USER_KEY, isAuthUser);

export const saveUserSnapshot = (user: AuthUser): void => {
  writeJson(USER_KEY, { ...user, imageUrl: null });
};

export const clearUserSnapshot = (): void => removeKey(USER_KEY);
