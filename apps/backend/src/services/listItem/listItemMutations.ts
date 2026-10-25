import { QueryFailedError } from 'typeorm';

import { ListCustomItem } from '../../entities/ListCustomItem';
import { ListItem, ListItemStatus } from '../../entities/ListItem';
import { getShoppingListForMember } from '../shoppingList/shoppingListMembership';
import type { ListItemRepositories } from './listItemRepositories';
import { serializeListItem, type SerializedListItem } from './listItemSerialization';

/** Exactly one way to name the item being added. */
export type AddListItemInput =
  | { catalogItemKey: string }
  | { customItemId: string }
  | { customName: string };

export type AddListItemResult = { item: SerializedListItem; created: boolean };

const ITEM_RELATIONS = { catalogItem: true, customItem: true } as const;

/** Postgres `unique_violation`: a concurrent request inserted the same row. */
const isUniqueViolation = (error: unknown): boolean =>
  error instanceof QueryFailedError &&
  (error.driverError as { code?: string } | undefined)?.code === '23505';

export const normalizeCustomName = (name: string): string =>
  name.trim().replace(/\s+/g, ' ');

async function findOrCreateCustomItem(
  repositories: ListItemRepositories,
  shoppingListId: string,
  name: string,
  userId: string,
): Promise<ListCustomItem> {
  const normalizedName = name.toLowerCase();
  const existing = await repositories.customItemRepository.findOne({
    where: { shoppingListId, normalizedName },
  });
  if (existing) return existing;

  try {
    return await repositories.customItemRepository.save(
      repositories.customItemRepository.create({
        shoppingListId,
        name,
        normalizedName,
        createdById: userId,
      }),
    );
  } catch (error: unknown) {
    if (!isUniqueViolation(error)) throw error;
    return repositories.customItemRepository.findOneOrFail({
      where: { shoppingListId, normalizedName },
    });
  }
}

/** Resolves the input to the reference columns of a `list_items` row. */
async function resolveReference(
  repositories: ListItemRepositories,
  shoppingListId: string,
  input: AddListItemInput,
  userId: string,
): Promise<Pick<ListItem, 'catalogItemKey' | 'customItemId'>> {
  if ('catalogItemKey' in input) {
    const exists = await repositories.catalogItemRepository.exists({
      where: { key: input.catalogItemKey },
    });
    if (!exists) throw new Error('Catalog item not found.');
    return { catalogItemKey: input.catalogItemKey, customItemId: null };
  }

  if ('customItemId' in input) {
    const exists = await repositories.customItemRepository.exists({
      where: { id: input.customItemId, shoppingListId },
    });
    if (!exists) throw new Error('Custom item not found.');
    return { catalogItemKey: null, customItemId: input.customItemId };
  }

  const customItem = await findOrCreateCustomItem(
    repositories,
    shoppingListId,
    normalizeCustomName(input.customName),
    userId,
  );
  return { catalogItemKey: null, customItemId: customItem.id };
}

/**
 * Puts an item on the list. An item already on it (bought or not) is moved
 * back to `to_buy` instead of being duplicated.
 */
export async function addListItem(
  repositories: ListItemRepositories,
  shoppingListId: string,
  input: AddListItemInput,
  userId: string,
): Promise<AddListItemResult> {
  await getShoppingListForMember(repositories, shoppingListId, userId);
  const reference = await resolveReference(repositories, shoppingListId, input, userId);
  const where = reference.catalogItemKey
    ? { shoppingListId, catalogItemKey: reference.catalogItemKey }
    : { shoppingListId, customItemId: reference.customItemId as string };
  const findExisting = () =>
    repositories.listItemRepository.findOne({ where, relations: ITEM_RELATIONS });

  let created = false;
  let item = await findExisting();
  if (!item) {
    try {
      const saved = await repositories.listItemRepository.save(
        repositories.listItemRepository.create({
          shoppingListId,
          ...reference,
          status: 'to_buy',
          source: 'user',
          addedById: userId,
        }),
      );
      created = true;
      item = await repositories.listItemRepository.findOneOrFail({
        where: { id: saved.id },
        relations: ITEM_RELATIONS,
      });
    } catch (error: unknown) {
      if (!isUniqueViolation(error)) throw error;
      item = await findExisting();
    }
  }

  if (!item) throw new Error('Item not found.');
  if (!created && item.status !== 'to_buy') {
    item.status = 'to_buy';
    item = await repositories.listItemRepository.save(item);
  }

  return { item: serializeListItem(item), created };
}

export async function setListItemStatus(
  repositories: ListItemRepositories,
  shoppingListId: string,
  itemId: string,
  status: ListItemStatus,
  userId: string,
): Promise<SerializedListItem> {
  await getShoppingListForMember(repositories, shoppingListId, userId);
  const item = await repositories.listItemRepository.findOne({
    where: { id: itemId, shoppingListId },
    relations: ITEM_RELATIONS,
  });
  if (!item) throw new Error('Item not found.');

  item.status = status;
  if (status === 'bought') item.lastBoughtAt = new Date();

  return serializeListItem(await repositories.listItemRepository.save(item));
}

/** Takes the item off the list; a custom item stays searchable in the list. */
export async function removeListItem(
  repositories: ListItemRepositories,
  shoppingListId: string,
  itemId: string,
  userId: string,
): Promise<void> {
  await getShoppingListForMember(repositories, shoppingListId, userId);
  const result = await repositories.listItemRepository.delete({ id: itemId, shoppingListId });
  if (!result.affected) throw new Error('Item not found.');
}
