import { IsNull, QueryFailedError } from 'typeorm';

import { ListCustomItem } from '../../entities/ListCustomItem';
import { ListItem, ListItemSource, ListItemStatus } from '../../entities/ListItem';
import { getShoppingListForMember } from '../shoppingList/shoppingListMembership';
import { recordItemEvent } from './itemEvents';
import type { ListItemRepositories } from './listItemRepositories';
import { serializeWithOverride, type ItemReference } from './itemOverrides';
import type { SerializedListItem } from './listItemSerialization';

/** Exactly one way to name the item being added. */
export type AddListItemInput =
  | { catalogItemKey: string }
  | { customItemId: string }
  | { customName: string };

export type AddListItemResult = { item: SerializedListItem; created: boolean };

const ITEM_RELATIONS = { catalogItem: true, customItem: true } as const;

/** Loads an item of a list the user is a member of, with what serializing needs. */
export async function findMemberListItem(
  repositories: ListItemRepositories,
  shoppingListId: string,
  itemId: string,
  userId: string,
): Promise<ListItem> {
  await getShoppingListForMember(repositories, shoppingListId, userId);
  const item = await repositories.listItemRepository.findOne({
    where: { id: itemId, shoppingListId },
    relations: ITEM_RELATIONS,
  });
  if (!item) throw new Error('Item not found.');
  return item;
}

/** An un-buy this soon after the buy undoes a mistaken tap (ADR-0024). */
export const UNBUY_GRACE_MS = 5 * 60_000;

/** Postgres `unique_violation`: a concurrent request inserted the same row. */
export const isUniqueViolation = (error: unknown): boolean =>
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

export type { ItemReference };

/** Resolves the input to the reference columns of a `list_items` row. */
export async function resolveReference(
  repositories: ListItemRepositories,
  shoppingListId: string,
  input: AddListItemInput,
  userId: string,
): Promise<ItemReference> {
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
 * Makes sure the referenced item is on the list and to buy. An item already
 * on it (bought or not) is moved back to `to_buy` instead of being
 * duplicated. `source` says why the item is to buy now (ADR-0024): a bought
 * item takes the caller's source, and a hand add claims a to-buy item. Each
 * add that puts the item to buy, or claims it, is logged (ADR-0027). A null
 * `userId` is the system adding it.
 */
export async function ensureListItem(
  repositories: ListItemRepositories,
  shoppingListId: string,
  reference: ItemReference,
  source: ListItemSource,
  userId: string | null,
): Promise<{ item: ListItem; created: boolean }> {
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
          source,
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
  let changed = created;
  if (!created) {
    const reopened = item.status !== 'to_buy';
    const nextSource = reopened || source === 'user' ? source : item.source;
    if (reopened || nextSource !== item.source) {
      item.status = 'to_buy';
      item.source = nextSource;
      item = await repositories.listItemRepository.save(item);
      changed = true;
    }
  }
  if (changed) await recordItemEvent(repositories, item, 'added', item.source, userId);

  return { item, created };
}

/** Puts an item on the list, as typed or picked by a member. */
export async function addListItem(
  repositories: ListItemRepositories,
  shoppingListId: string,
  input: AddListItemInput,
  userId: string,
): Promise<AddListItemResult> {
  await getShoppingListForMember(repositories, shoppingListId, userId);
  const reference = await resolveReference(repositories, shoppingListId, input, userId);
  const { item, created } = await ensureListItem(
    repositories,
    shoppingListId,
    reference,
    'user',
    userId,
  );
  return { item: await serializeWithOverride(repositories, item), created };
}

export async function setListItemStatus(
  repositories: ListItemRepositories,
  shoppingListId: string,
  itemId: string,
  status: ListItemStatus,
  userId: string,
): Promise<SerializedListItem> {
  const item = await findMemberListItem(repositories, shoppingListId, itemId, userId);
  if (item.status === status) return serializeWithOverride(repositories, item);

  const now = new Date();
  const boughtAt = item.lastBoughtAt;
  const mistakenTap =
    status === 'to_buy' && boughtAt !== null && now.getTime() - boughtAt.getTime() <= UNBUY_GRACE_MS;
  const changes: Pick<ListItem, 'status'> & Partial<Pick<ListItem, 'source' | 'lastBoughtAt'>> = {
    status,
  };
  if (status === 'bought') changes.lastBoughtAt = now;
  // Put back from Last used: a member adds it by hand.
  else if (!mistakenTap) changes.source = 'user';

  // Only the request that moves the item out of its current status records
  // the change, so a double tap or a concurrent request never logs it twice.
  const { affected } = await repositories.listItemRepository.update(
    { id: item.id, shoppingListId, status: item.status },
    changes,
  );
  if (!affected) {
    return serializeWithOverride(
      repositories,
      await findMemberListItem(repositories, shoppingListId, itemId, userId),
    );
  }
  Object.assign(item, changes);

  if (status === 'bought') {
    // Buying an item meets every dish need still open on it (ADR-0024).
    await repositories.listItemDishRepository.update(
      { listItemId: item.id, fulfilledAt: IsNull() },
      { fulfilledAt: now },
    );
    await recordItemEvent(repositories, item, 'bought', item.source, userId);
  } else if (mistakenTap) {
    // A mistaken tap: reopen the dish needs that this buy met.
    await repositories.listItemDishRepository.update(
      { listItemId: item.id, fulfilledAt: boughtAt },
      { fulfilledAt: null },
    );
    await recordItemEvent(repositories, item, 'unbought', item.source, userId);
  } else {
    await recordItemEvent(repositories, item, 'added', 'user', userId);
  }

  return serializeWithOverride(repositories, item);
}

/**
 * Takes the item off the list; a custom item stays searchable in the list.
 * Removing an item still to buy is logged: it means "not finished yet"
 * (ADR-0027).
 */
export async function removeListItem(
  repositories: ListItemRepositories,
  shoppingListId: string,
  itemId: string,
  userId: string,
): Promise<void> {
  const item = await findMemberListItem(repositories, shoppingListId, itemId, userId);
  const result = await repositories.listItemRepository.delete({ id: itemId, shoppingListId });
  if (!result.affected) throw new Error('Item not found.');
  if (item.status === 'to_buy') {
    await recordItemEvent(repositories, item, 'removed', item.source, userId);
  }
}
