/**
 * Unit tests for the list-item domain modules. The modules take their
 * repositories as an argument, so fakes are passed in directly; the data
 * source is mocked only so importing the entity graph has no side effects.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryFailedError } from 'typeorm';

vi.mock('../src/db/data-source', () => ({ AppDataSource: { getRepository: vi.fn() } }));

import type { ListItemRepositories } from '../src/services/listItem/listItemRepositories';
import {
  addListItem,
  normalizeCustomName,
  removeListItem,
  setListItemStatus,
} from '../src/services/listItem/listItemMutations';
import { getSectionOrder } from '../src/services/listItem/listItemQueries';

const memberQuery = {
  innerJoin: vi.fn().mockReturnThis(),
  leftJoinAndSelect: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  getOne: vi.fn(),
};

const repo = () => ({
  find: vi.fn(),
  findOne: vi.fn(),
  findOneOrFail: vi.fn(),
  exists: vi.fn(),
  save: vi.fn(async (row: Record<string, unknown>) => ({ id: 'saved-id', ...row })),
  create: vi.fn((row: Record<string, unknown>) => row),
  delete: vi.fn(),
});

let repos: Record<string, ReturnType<typeof repo>> & { shoppingListRepository: unknown };

const uniqueViolation = () =>
  new QueryFailedError('INSERT', [], Object.assign(new Error('dup'), { code: '23505' }));

beforeEach(() => {
  vi.clearAllMocks();
  memberQuery.innerJoin.mockReturnThis();
  memberQuery.leftJoinAndSelect.mockReturnThis();
  memberQuery.where.mockReturnThis();
  memberQuery.getOne.mockResolvedValue({ id: 'list-1', members: [] });
  repos = {
    shoppingListRepository: { createQueryBuilder: vi.fn(() => memberQuery) },
    catalogItemRepository: repo(),
    catalogSectionRepository: repo(),
    customItemRepository: repo(),
    listItemRepository: repo(),
    sectionOrderRepository: repo(),
  };
});

const r = () => repos as unknown as ListItemRepositories;
const row = (overrides: Record<string, unknown>) => ({
  id: 'item-1',
  status: 'to_buy',
  source: 'user',
  lastBoughtAt: null,
  catalogItemKey: 'milk',
  catalogItem: { key: 'milk', sectionKey: 'milk-cheese' },
  customItemId: null,
  customItem: null,
  ...overrides,
});

describe('addListItem', () => {
  it('rejects non-members before touching items', async () => {
    memberQuery.getOne.mockResolvedValue(null);
    await expect(addListItem(r(), 'list-1', { catalogItemKey: 'milk' }, 'u1')).rejects.toThrow(/not found/);
    expect(repos.listItemRepository.save).not.toHaveBeenCalled();
  });

  it('rejects an unknown catalog key', async () => {
    repos.catalogItemRepository.exists.mockResolvedValue(false);
    await expect(addListItem(r(), 'list-1', { catalogItemKey: 'nope' }, 'u1')).rejects.toThrow('Catalog item not found.');
  });

  it('creates a to-buy row for a new catalog item', async () => {
    repos.catalogItemRepository.exists.mockResolvedValue(true);
    repos.listItemRepository.findOne.mockResolvedValue(null);
    repos.listItemRepository.findOneOrFail.mockResolvedValue(row({ id: 'saved-id' }));

    const result = await addListItem(r(), 'list-1', { catalogItemKey: 'milk' }, 'u1');

    expect(result.created).toBe(true);
    expect(result.item).toMatchObject({ id: 'saved-id', catalogItemKey: 'milk', sectionKey: 'milk-cheese' });
    expect(repos.listItemRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ shoppingListId: 'list-1', catalogItemKey: 'milk', customItemId: null, addedById: 'u1' }),
    );
  });

  it('moves an already-bought item back to to_buy instead of duplicating it', async () => {
    repos.catalogItemRepository.exists.mockResolvedValue(true);
    repos.listItemRepository.findOne.mockResolvedValue(row({ status: 'bought' }));

    const result = await addListItem(r(), 'list-1', { catalogItemKey: 'milk' }, 'u1');

    expect(result.created).toBe(false);
    expect(result.item.status).toBe('to_buy');
    expect(repos.listItemRepository.create).not.toHaveBeenCalled();
  });

  it('reuses a custom item with the same name, ignoring case and spacing', async () => {
    repos.customItemRepository.findOne.mockResolvedValue({ id: 'c1', name: "Nonna's sauce" });
    repos.listItemRepository.findOne.mockResolvedValue(null);
    repos.listItemRepository.findOneOrFail.mockResolvedValue(
      row({ catalogItemKey: null, catalogItem: null, customItemId: 'c1', customItem: { id: 'c1', name: "Nonna's sauce" } }),
    );

    const result = await addListItem(r(), 'list-1', { customName: "  NONNA'S   sauce " }, 'u1');

    expect(repos.customItemRepository.findOne).toHaveBeenCalledWith({
      where: { shoppingListId: 'list-1', normalizedName: "nonna's sauce" },
    });
    expect(repos.customItemRepository.save).not.toHaveBeenCalled();
    expect(result.item).toMatchObject({ customItem: { id: 'c1', name: "Nonna's sauce" }, sectionKey: 'own-items' });
  });

  it('falls back to the concurrent row on a unique violation', async () => {
    repos.catalogItemRepository.exists.mockResolvedValue(true);
    repos.listItemRepository.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(row({}));
    repos.listItemRepository.save.mockRejectedValueOnce(uniqueViolation());

    const result = await addListItem(r(), 'list-1', { catalogItemKey: 'milk' }, 'u1');

    expect(result).toMatchObject({ created: false, item: { id: 'item-1' } });
  });

  it('rejects a custom item id from another list', async () => {
    repos.customItemRepository.exists.mockResolvedValue(false);
    await expect(
      addListItem(r(), 'list-1', { customItemId: '11111111-1111-1111-1111-111111111111' }, 'u1'),
    ).rejects.toThrow('Custom item not found.');
  });
});

describe('setListItemStatus', () => {
  it('records when an item was bought', async () => {
    repos.listItemRepository.findOne.mockResolvedValue(row({}));
    const item = await setListItemStatus(r(), 'list-1', 'item-1', 'bought', 'u1');
    expect(item.status).toBe('bought');
    expect(item.lastBoughtAt).toEqual(expect.any(String));
  });

  it('keeps lastBoughtAt when putting an item back', async () => {
    repos.listItemRepository.findOne.mockResolvedValue(row({ status: 'bought', lastBoughtAt: new Date('2026-10-01T00:00:00Z') }));
    const item = await setListItemStatus(r(), 'list-1', 'item-1', 'to_buy', 'u1');
    expect(item).toMatchObject({ status: 'to_buy', lastBoughtAt: '2026-10-01T00:00:00.000Z' });
  });

  it('404s an item of another list', async () => {
    repos.listItemRepository.findOne.mockResolvedValue(null);
    await expect(setListItemStatus(r(), 'list-1', 'x', 'bought', 'u1')).rejects.toThrow('Item not found.');
  });
});

describe('removeListItem', () => {
  it('deletes only within the list', async () => {
    repos.listItemRepository.delete.mockResolvedValue({ affected: 1 });
    await removeListItem(r(), 'list-1', 'item-1', 'u1');
    expect(repos.listItemRepository.delete).toHaveBeenCalledWith({ id: 'item-1', shoppingListId: 'list-1' });
  });

  it('404s when nothing was deleted', async () => {
    repos.listItemRepository.delete.mockResolvedValue({ affected: 0 });
    await expect(removeListItem(r(), 'list-1', 'item-1', 'u1')).rejects.toThrow('Item not found.');
  });
});

describe('getSectionOrder', () => {
  it('puts the list overrides first, then the remaining defaults', async () => {
    repos.catalogSectionRepository.find.mockResolvedValue([
      { key: 'fruits-vegetables' },
      { key: 'bread-pastries' },
      { key: 'milk-cheese' },
      { key: 'own-items' },
    ]);
    repos.sectionOrderRepository.find.mockResolvedValue([
      { sectionKey: 'milk-cheese' },
      { sectionKey: 'fruits-vegetables' },
    ]);

    expect(await getSectionOrder(r(), 'list-1')).toEqual([
      'milk-cheese',
      'fruits-vegetables',
      'bread-pastries',
      'own-items',
    ]);
  });
});

describe('normalizeCustomName', () => {
  it('trims and collapses whitespace', () => {
    expect(normalizeCustomName('  Oat   drink ')).toBe('Oat drink');
  });
});
