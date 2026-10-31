import { withAdvisoryLock, type LockedRun } from '../../db/advisoryLock';
import type { ListItemEvent } from '../../entities/ListItemEvent';
import { ensureListItem, type ItemReference } from './listItemMutations';
import { createListItemRepositories, type ListItemRepositories } from './listItemRepositories';
import { deriveHabit, isDue } from './recurrence';

/** The list-item tables plus what a whole run needs (ADR-0027). */
export type AutoFillRepositories = ListItemRepositories & {
  /** Ids of the lists that have any item history. */
  findListIdsWithEvents: () => Promise<string[]>;
  /** Runs `work` unless another replica is already running the job. */
  withLock: <T>(work: () => Promise<T>) => Promise<LockedRun<T>>;
};

export type AutoFillRun = { skipped: true } | { skipped: false; lists: number; filled: number };

/** Any constant shared by every replica; it only has to be unique to this job. */
const AUTO_FILL_LOCK_KEY = 271_828;

export function createAutoFillRepositories(): AutoFillRepositories {
  const repositories = createListItemRepositories();
  return {
    ...repositories,
    findListIdsWithEvents: async () => {
      const rows = await repositories.listItemEventRepository
        .createQueryBuilder('event')
        .select('DISTINCT event.shopping_list_id', 'id')
        .getRawMany<{ id: string }>();
      return rows.map((row) => row.id);
    },
    withLock: (work) => withAdvisoryLock(AUTO_FILL_LOCK_KEY, work),
  };
}

const productKey = (reference: ItemReference): string =>
  reference.catalogItemKey ?? `custom:${reference.customItemId}`;

/**
 * Adds to the list, as `source: 'recurring'` by no member, every product of
 * its history that is due and not already to buy. Returns the added keys.
 */
export async function autoFillList(
  repositories: ListItemRepositories,
  shoppingListId: string,
  now: Date,
): Promise<string[]> {
  const events = await repositories.listItemEventRepository.find({
    where: { shoppingListId },
    order: { at: 'ASC' },
  });
  const toBuy = await repositories.listItemRepository.find({
    where: { shoppingListId, status: 'to_buy' },
  });
  const onList = new Set(toBuy.map(productKey));

  const byProduct = new Map<string, ListItemEvent[]>();
  for (const event of events) {
    const key = productKey(event);
    const productEvents = byProduct.get(key);
    if (productEvents) productEvents.push(event);
    else byProduct.set(key, [event]);
  }

  const added: string[] = [];
  for (const [key, productEvents] of byProduct) {
    if (onList.has(key) || !isDue(deriveHabit(productEvents), now)) continue;
    const { catalogItemKey, customItemId } = productEvents[0];
    await ensureListItem(
      repositories,
      shoppingListId,
      { catalogItemKey, customItemId },
      'recurring',
      null,
    );
    added.push(key);
  }
  return added;
}

/**
 * One run of the job over every list with history. A list that fails is
 * logged and skipped, so it cannot hold the others back.
 */
export async function runAutoFill(
  now: Date = new Date(),
  repositories: AutoFillRepositories = createAutoFillRepositories(),
): Promise<AutoFillRun> {
  const run = await repositories.withLock(async () => {
    const listIds = await repositories.findListIdsWithEvents();
    let filled = 0;
    for (const listId of listIds) {
      try {
        const added = await autoFillList(repositories, listId, now);
        if (added.length > 0) {
          filled += 1;
          console.log(`[auto-fill] list=${listId} added=[${added.join(',')}]`);
        }
      } catch (error: unknown) {
        console.error('[auto-fill] list=%s failed', listId, error);
      }
    }
    return { lists: listIds.length, filled };
  });

  if (!run.acquired) {
    console.log('[auto-fill] run: skipped, another replica holds the lock');
    return { skipped: true };
  }
  console.log(`[auto-fill] run: lists=${run.result.lists} filled=${run.result.filled}`);
  return { skipped: false, ...run.result };
}
