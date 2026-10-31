/**
 * Unit tests for the auto-fill job (ADR-0027). Repositories and the lock are
 * fakes; the data source is mocked only so importing the entity graph has no
 * side effects.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db/data-source', () => ({ AppDataSource: { getRepository: vi.fn() } }));

import { autoFillList, runAutoFill, type AutoFillRepositories } from '../src/services/listItem/autoFill';

const NOW = new Date('2026-10-30T10:00:00Z');
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);

/** Milk added by hand and bought every 7 days, last bought `lastBought` days ago. */
const milkHistory = (lastBought: number, listId = 'list-1') =>
  [lastBought + 15, lastBought + 14, lastBought + 8, lastBought + 7, lastBought + 1, lastBought].map(
    (ago, index) => ({
      shoppingListId: listId,
      catalogItemKey: 'milk',
      customItemId: null,
      kind: index % 2 === 0 ? 'added' : 'bought',
      source: 'user',
      at: daysAgo(ago),
    }),
  );

const repo = () => ({
  find: vi.fn(async () => [] as unknown[]),
  findOne: vi.fn(),
  findOneOrFail: vi.fn(),
  save: vi.fn(async (row: Record<string, unknown>) => ({ id: 'saved-id', ...row })),
  create: vi.fn((row: Record<string, unknown>) => row),
  insert: vi.fn(),
});

let repos: Record<string, ReturnType<typeof repo>> & {
  findListIdsWithEvents: ReturnType<typeof vi.fn>;
  withLock: ReturnType<typeof vi.fn>;
};
const r = () => repos as unknown as AutoFillRepositories;

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  repos = {
    listItemRepository: repo(),
    listItemEventRepository: repo(),
    findListIdsWithEvents: vi.fn(async () => ['list-1']),
    withLock: vi.fn(async (work: () => Promise<unknown>) => ({ acquired: true, result: await work() })),
  };
  // A bought milk row, as ensureListItem finds it before reopening it.
  repos.listItemRepository.findOne.mockResolvedValue({
    id: 'item-1',
    shoppingListId: 'list-1',
    catalogItemKey: 'milk',
    customItemId: null,
    status: 'bought',
    source: 'user',
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('autoFillList', () => {
  it('puts a due product back to buy as recurring, added by no member', async () => {
    repos.listItemEventRepository.find.mockResolvedValue(milkHistory(8));

    const added = await autoFillList(r(), 'list-1', NOW);

    expect(added).toEqual(['milk']);
    expect(repos.listItemRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'to_buy', source: 'recurring' }),
    );
    expect(repos.listItemEventRepository.insert).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'added', source: 'recurring', userId: null, catalogItemKey: 'milk' }),
    );
  });

  it('leaves a product that is not due yet', async () => {
    repos.listItemEventRepository.find.mockResolvedValue(milkHistory(3));
    expect(await autoFillList(r(), 'list-1', NOW)).toEqual([]);
    expect(repos.listItemRepository.save).not.toHaveBeenCalled();
  });

  it('skips a due product that is already to buy', async () => {
    repos.listItemEventRepository.find.mockResolvedValue(milkHistory(8));
    repos.listItemRepository.find.mockResolvedValue([{ catalogItemKey: 'milk', customItemId: null }]);
    expect(await autoFillList(r(), 'list-1', NOW)).toEqual([]);
  });

  it('holds back a product snoozed by a "not finished yet" removal', async () => {
    repos.listItemEventRepository.find.mockResolvedValue([
      ...milkHistory(8),
      { catalogItemKey: 'milk', customItemId: null, kind: 'added', source: 'recurring', at: daysAgo(1) },
      { catalogItemKey: 'milk', customItemId: null, kind: 'removed', source: 'recurring', at: daysAgo(1) },
    ]);
    expect(await autoFillList(r(), 'list-1', NOW)).toEqual([]);
  });

  it('keys custom items by id', async () => {
    repos.listItemEventRepository.find.mockResolvedValue(
      milkHistory(8).map((event) => ({ ...event, catalogItemKey: null, customItemId: 'c1' })),
    );
    expect(await autoFillList(r(), 'list-1', NOW)).toEqual(['custom:c1']);
  });
});

describe('runAutoFill', () => {
  it('fills every list with history and reports the run', async () => {
    repos.findListIdsWithEvents.mockResolvedValue(['list-1', 'list-2']);
    repos.listItemEventRepository.find.mockImplementation(async (options: unknown) => {
      const { shoppingListId } = (options as { where: { shoppingListId: string } }).where;
      return shoppingListId === 'list-1' ? milkHistory(8) : milkHistory(2, 'list-2');
    });

    expect(await runAutoFill(NOW, r())).toEqual({ skipped: false, lists: 2, filled: 1 });
    expect(console.log).toHaveBeenCalledWith('[auto-fill] list=list-1 added=[milk]');
    expect(console.log).toHaveBeenCalledWith('[auto-fill] run: lists=2 filled=1');
  });

  it('skips the run while another replica holds the lock', async () => {
    repos.withLock.mockResolvedValue({ acquired: false });
    expect(await runAutoFill(NOW, r())).toEqual({ skipped: true });
    expect(repos.findListIdsWithEvents).not.toHaveBeenCalled();
  });

  it('logs a failing list and still fills the others', async () => {
    repos.findListIdsWithEvents.mockResolvedValue(['broken', 'list-1']);
    repos.listItemEventRepository.find.mockImplementation(async (options: unknown) => {
      const { shoppingListId } = (options as { where: { shoppingListId: string } }).where;
      if (shoppingListId === 'broken') throw new Error('boom');
      return milkHistory(8);
    });

    expect(await runAutoFill(NOW, r())).toEqual({ skipped: false, lists: 2, filled: 1 });
    expect(console.error).toHaveBeenCalledWith('[auto-fill] list=broken failed', expect.any(Error));
  });
});
