import { findMemberListItem } from './listItemMutations';
import type { ListItemRepositories } from './listItemRepositories';
import { serializeListItem, type SerializedListItem } from './listItemSerialization';

/** One override of a list item (ADR-0026); `null` clears it. */
export type ListItemOverride = { iconKey: string | null } | { sectionKey: string | null };

/** Sets the item's icon or store section on this list. */
export async function setListItemOverride(
  repositories: ListItemRepositories,
  shoppingListId: string,
  itemId: string,
  override: ListItemOverride,
  userId: string,
): Promise<SerializedListItem> {
  const item = await findMemberListItem(repositories, shoppingListId, itemId, userId);

  if ('iconKey' in override) item.iconKey = override.iconKey;
  else item.sectionOverrideKey = override.sectionKey;

  return serializeListItem(await repositories.listItemRepository.save(item));
}
