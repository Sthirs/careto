import type { ListItem, ListItemSource } from '../../entities/ListItem';
import type { ListItemEventKind } from '../../entities/ListItemEvent';
import type { ListItemRepositories } from './listItemRepositories';

type EventItem = Pick<ListItem, 'shoppingListId' | 'catalogItemKey' | 'customItemId'>;
type ItemRef = Pick<ListItem, 'catalogItemKey' | 'customItemId'>;

/**
 * Appends one event to the list's item history (ADR-0027). `userId` is null
 * when the system acted. `source` is why the item was to buy at that moment.
 * `at` is when it happened, if not now: an offline change synced later
 * (ADR-0030).
 */
export async function recordItemEvent(
  repositories: Pick<ListItemRepositories, 'listItemEventRepository'>,
  item: EventItem,
  kind: ListItemEventKind,
  source: ListItemSource,
  userId: string | null,
  at?: Date,
): Promise<void> {
  await repositories.listItemEventRepository.insert({
    shoppingListId: item.shoppingListId,
    catalogItemKey: item.catalogItemKey,
    customItemId: item.customItemId,
    kind,
    source,
    userId,
    ...(at ? { at } : {}),
  });
}

/**
 * True when the list's history already has an event of the same product
 * strictly later than `at`: a change tapped offline at `at` and synced late
 * has been overtaken, so it must have no effect (ADR-0031). An equal time is
 * not later, so the resend of a change that already landed is not refused
 * here; the status checks make it a no-op instead.
 */
export async function isSupersededAt(
  repositories: Pick<ListItemRepositories, 'listItemEventRepository'>,
  shoppingListId: string,
  reference: ItemRef,
  at: Date,
): Promise<boolean> {
  const where = reference.catalogItemKey
    ? { shoppingListId, catalogItemKey: reference.catalogItemKey }
    : { shoppingListId, customItemId: reference.customItemId as string };
  const latest = await repositories.listItemEventRepository.findOne({
    where,
    select: { id: true, at: true },
    order: { at: 'DESC' },
  });
  return Boolean(latest && latest.at.getTime() > at.getTime());
}
