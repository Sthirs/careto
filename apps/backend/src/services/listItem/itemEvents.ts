import type { ListItem, ListItemSource } from '../../entities/ListItem';
import type { ListItemEventKind } from '../../entities/ListItemEvent';
import type { ListItemRepositories } from './listItemRepositories';

type EventItem = Pick<ListItem, 'shoppingListId' | 'catalogItemKey' | 'customItemId'>;

/**
 * Appends one event to the list's item history (ADR-0027). `userId` is null
 * when the system acted. `source` is why the item was to buy at that moment.
 */
export async function recordItemEvent(
  repositories: Pick<ListItemRepositories, 'listItemEventRepository'>,
  item: EventItem,
  kind: ListItemEventKind,
  source: ListItemSource,
  userId: string | null,
): Promise<void> {
  await repositories.listItemEventRepository.insert({
    shoppingListId: item.shoppingListId,
    catalogItemKey: item.catalogItemKey,
    customItemId: item.customItemId,
    kind,
    source,
    userId,
  });
}
