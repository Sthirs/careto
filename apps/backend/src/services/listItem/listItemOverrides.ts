import { getShoppingListForMember } from '../shoppingList/shoppingListMembership';
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
  await getShoppingListForMember(repositories, shoppingListId, userId);
  const item = await repositories.listItemRepository.findOne({
    where: { id: itemId, shoppingListId },
    relations: { catalogItem: true, customItem: true },
  });
  if (!item) throw new Error('Item not found.');

  if ('iconKey' in override) item.iconKey = override.iconKey;
  else item.sectionOverrideKey = override.sectionKey;

  return serializeListItem(await repositories.listItemRepository.save(item));
}
