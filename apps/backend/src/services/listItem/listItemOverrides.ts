import { findMemberListItem } from './listItemMutations';
import type { ListItemRepositories } from './listItemRepositories';
import { upsertOverride, type ItemOverridePatch } from './itemOverrides';
import { serializeListItem, type SerializedListItem } from './listItemSerialization';

/** One override of a list item (ADR-0026, ADR-0029); `null` clears it. */
export type ListItemOverride = ItemOverridePatch;

/**
 * Sets the item's icon or store section on this list. It is kept for the
 * item, not its list row, so dishes and search show it too (ADR-0029).
 */
export async function setListItemOverride(
  repositories: ListItemRepositories,
  shoppingListId: string,
  itemId: string,
  override: ListItemOverride,
  userId: string,
): Promise<SerializedListItem> {
  const item = await findMemberListItem(repositories, shoppingListId, itemId, userId);
  const saved = await upsertOverride(
    repositories.itemOverrideRepository,
    shoppingListId,
    item,
    override,
  );
  return serializeListItem(item, saved);
}
