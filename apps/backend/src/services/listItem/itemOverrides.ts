import type { Repository } from 'typeorm';

import type { ListItem } from '../../entities/ListItem';
import { ListItemOverride } from '../../entities/ListItemOverride';
import type { ListItemRepositories } from './listItemRepositories';
import { serializeListItem, type SerializedListItem } from './listItemSerialization';

/** A catalog item or one of the list's custom items, never both. */
export type ItemReference = Pick<ListItem, 'catalogItemKey' | 'customItemId'>;

/** The icon and section a list chose for one item (ADR-0029). */
export type ItemOverride = { iconKey: string | null; sectionKey: string | null };

/** An override together with the item it belongs to. */
export type SerializedItemOverride = ItemReference & ItemOverride;

/** One change to an item's override; `null` clears it. */
export type ItemOverridePatch = { iconKey: string | null } | { sectionKey: string | null };

/** The list's overrides, keyed by `referenceKey`. */
export type ItemOverrideMap = Map<string, ItemOverride>;

type OverrideRepository = Repository<ListItemOverride>;

export const referenceKey = (reference: ItemReference): string =>
  reference.catalogItemKey ? `catalog:${reference.catalogItemKey}` : `custom:${reference.customItemId}`;

const whereReference = (shoppingListId: string, reference: ItemReference) =>
  reference.catalogItemKey
    ? { shoppingListId, catalogItemKey: reference.catalogItemKey }
    : { shoppingListId, customItemId: reference.customItemId as string };

const toOverride = (row: ListItemOverride): ItemOverride => ({
  iconKey: row.iconKey,
  sectionKey: row.sectionKey,
});

/** Every override the list holds, on the list or not. */
export async function listOverrides(
  repository: OverrideRepository,
  shoppingListId: string,
): Promise<SerializedItemOverride[]> {
  const rows = await repository.find({ where: { shoppingListId } });
  return rows.map((row) => ({
    catalogItemKey: row.catalogItemKey,
    customItemId: row.customItemId,
    ...toOverride(row),
  }));
}

export const toOverrideMap = (overrides: SerializedItemOverride[]): ItemOverrideMap =>
  new Map(overrides.map((override) => [referenceKey(override), override]));

export async function loadOverrides(
  repository: OverrideRepository,
  shoppingListId: string,
): Promise<ItemOverrideMap> {
  return toOverrideMap(await listOverrides(repository, shoppingListId));
}

export async function findOverride(
  repository: OverrideRepository,
  shoppingListId: string,
  reference: ItemReference,
): Promise<ItemOverride | null> {
  const row = await repository.findOne({ where: whereReference(shoppingListId, reference) });
  return row ? toOverride(row) : null;
}

/** Applies `patch`; the row goes away once it overrides nothing. */
export async function upsertOverride(
  repository: OverrideRepository,
  shoppingListId: string,
  reference: ItemReference,
  patch: ItemOverridePatch,
): Promise<ItemOverride | null> {
  const row =
    (await repository.findOne({ where: whereReference(shoppingListId, reference) })) ??
    repository.create({
      shoppingListId,
      catalogItemKey: reference.catalogItemKey,
      customItemId: reference.customItemId,
      iconKey: null,
      sectionKey: null,
    });

  if ('iconKey' in patch) row.iconKey = patch.iconKey;
  else row.sectionKey = patch.sectionKey;

  if (row.iconKey === null && row.sectionKey === null) {
    if (row.id) await repository.delete({ id: row.id });
    return null;
  }
  return toOverride(await repository.save(row));
}

/** Serializes one list item with its list's override. */
export async function serializeWithOverride(
  repositories: ListItemRepositories,
  item: ListItem,
): Promise<SerializedListItem> {
  const override = await findOverride(
    repositories.itemOverrideRepository,
    item.shoppingListId,
    item,
  );
  return serializeListItem(item, override);
}
