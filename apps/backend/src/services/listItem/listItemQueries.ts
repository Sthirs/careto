import { getShoppingListForMember } from '../shoppingList/shoppingListMembership';
import type { ListItemRepositories } from './listItemRepositories';
import {
  serializeCustomItem,
  serializeListItem,
  type SerializedCustomItem,
  type SerializedListItem,
} from './listItemSerialization';

export type ListItemsView = {
  sectionOrder: string[];
  items: SerializedListItem[];
  customItems: SerializedCustomItem[];
};

/**
 * The list's effective section order: its own positions first, then every
 * section it never placed, in default catalog order.
 */
export async function getSectionOrder(
  repositories: ListItemRepositories,
  shoppingListId: string,
): Promise<string[]> {
  const sections = await repositories.catalogSectionRepository.find({
    order: { position: 'ASC' },
  });
  const overrides = await repositories.sectionOrderRepository.find({
    where: { shoppingListId },
    order: { position: 'ASC' },
  });

  const ordered = overrides.map((override) => override.sectionKey);
  const placed = new Set(ordered);
  return [...ordered, ...sections.map((s) => s.key).filter((key) => !placed.has(key))];
}

export async function getListItems(
  repositories: ListItemRepositories,
  shoppingListId: string,
  userId: string,
): Promise<ListItemsView> {
  await getShoppingListForMember(repositories, shoppingListId, userId);

  const items = await repositories.listItemRepository.find({
    where: { shoppingListId },
    relations: { catalogItem: true, customItem: true },
    order: { createdAt: 'ASC' },
  });
  const customItems = await repositories.customItemRepository.find({
    where: { shoppingListId },
    order: { name: 'ASC' },
  });

  return {
    sectionOrder: await getSectionOrder(repositories, shoppingListId),
    items: items.map(serializeListItem),
    customItems: customItems.map(serializeCustomItem),
  };
}
