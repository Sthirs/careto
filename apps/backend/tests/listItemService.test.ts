/**
 * Unit tests for the list-item domain modules. The modules take their
 * repositories as an argument, so fakes are passed in directly; the data
 * source is mocked only so importing the entity graph has no side effects.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryFailedError } from 'typeorm';

vi.mock('../src/db/data-source', () => ({ AppDataSource: { getRepository: vi.fn() } }));

import { CATALOG_SECTIONS, OWN_ITEMS_SECTION_KEY } from '../src/services/catalog/catalogData';
import type { ListItemRepositories } from '../src/services/listItem/listItemRepositories';
import {
  addListItem,
  normalizeCustomName,
  removeListItem,
  setListItemStatus,
} from '../src/services/listItem/listItemMutations';
import { setListItemOverride } from '../src/services/listItem/listItemOverrides';
import { getSectionOrder } from '../src/services/listItem/listItemQueries';
import {
  replaceListSectionOrder,
  resetListSectionOrder,
} from '../src/services/listItem/listItemSectionOrder';
import { serializeListItem } from '../src/services/listItem/listItemSerialization';

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
  update: vi.fn(),
  count: vi.fn(),
  insert: vi.fn(),
});

let repos: Record<string, ReturnType<typeof repo>> & {
  shoppingListRepository: unknown;
  replaceSectionOrder: unknown;
};
const orderTx = { delete: vi.fn(), insert: vi.fn() };

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
    listItemDishRepository: repo(),
    listItemEventRepository: repo(),
    itemOverrideRepository: repo(),
    sectionOrderRepository: repo(),
    replaceSectionOrder: vi.fn(async (work: (orders: typeof orderTx) => Promise<void>) => work(orderTx)),
  };
  repos.listItemRepository.update.mockResolvedValue({ affected: 1 });
});

const r = () => repos as unknown as ListItemRepositories;
const row = (overrides: Record<string, unknown>) => ({
  id: 'item-1',
  shoppingListId: 'list-1',
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
      expect.objectContaining({ shoppingListId: 'list-1', catalogItemKey: 'milk', customItemId: null, source: 'user', addedById: 'u1' }),
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

  it('claims a to-buy dish item when a member adds it by hand', async () => {
    repos.catalogItemRepository.exists.mockResolvedValue(true);
    repos.listItemRepository.findOne.mockResolvedValue(row({ source: 'dish' }));

    const result = await addListItem(r(), 'list-1', { catalogItemKey: 'milk' }, 'u1');

    expect(repos.listItemRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'to_buy', source: 'user' }),
    );
    expect(result.item.source).toBe('user');
  });

  it('leaves a to-buy hand item untouched when it is added again', async () => {
    repos.catalogItemRepository.exists.mockResolvedValue(true);
    repos.listItemRepository.findOne.mockResolvedValue(row({}));

    await addListItem(r(), 'list-1', { catalogItemKey: 'milk' }, 'u1');

    expect(repos.listItemRepository.save).not.toHaveBeenCalled();
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

  it('buys only an item that is still to buy', async () => {
    repos.listItemRepository.findOne.mockResolvedValue(row({}));
    await setListItemStatus(r(), 'list-1', 'item-1', 'bought', 'u1');
    expect(repos.listItemRepository.update).toHaveBeenCalledWith(
      { id: 'item-1', shoppingListId: 'list-1', status: 'to_buy' },
      { status: 'bought', lastBoughtAt: expect.any(Date) },
    );
  });

  it('meets the open dish needs of a bought item', async () => {
    repos.listItemRepository.findOne.mockResolvedValue(row({}));
    await setListItemStatus(r(), 'list-1', 'item-1', 'bought', 'u1');
    expect(repos.listItemDishRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({ listItemId: 'item-1' }),
      { fulfilledAt: expect.any(Date) },
    );
  });

  it('reopens the dish needs of a buy undone within the grace period', async () => {
    const boughtAt = new Date(Date.now() - 60_000);
    repos.listItemRepository.findOne.mockResolvedValue(
      row({ status: 'bought', source: 'dish', lastBoughtAt: boughtAt }),
    );

    const item = await setListItemStatus(r(), 'list-1', 'item-1', 'to_buy', 'u1');

    expect(repos.listItemDishRepository.update).toHaveBeenCalledWith(
      { listItemId: 'item-1', fulfilledAt: boughtAt },
      { fulfilledAt: null },
    );
    expect(item.source).toBe('dish');
  });

  it('puts an item back by hand after the grace period', async () => {
    repos.listItemRepository.findOne.mockResolvedValue(
      row({ status: 'bought', source: 'dish', lastBoughtAt: new Date(Date.now() - 10 * 60_000) }),
    );

    const item = await setListItemStatus(r(), 'list-1', 'item-1', 'to_buy', 'u1');

    expect(repos.listItemDishRepository.update).not.toHaveBeenCalled();
    expect(item.source).toBe('user');
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
    repos.listItemRepository.findOne.mockResolvedValue(row({ status: 'bought' }));
    repos.listItemRepository.delete.mockResolvedValue({ affected: 1 });
    await removeListItem(r(), 'list-1', 'item-1', 'u1');
    expect(repos.listItemRepository.delete).toHaveBeenCalledWith({ id: 'item-1', shoppingListId: 'list-1' });
  });

  it('404s an item of another list', async () => {
    repos.listItemRepository.findOne.mockResolvedValue(null);
    await expect(removeListItem(r(), 'list-1', 'item-1', 'u1')).rejects.toThrow('Item not found.');
    expect(repos.listItemRepository.delete).not.toHaveBeenCalled();
  });

  it('404s when nothing was deleted', async () => {
    repos.listItemRepository.findOne.mockResolvedValue(row({}));
    repos.listItemRepository.delete.mockResolvedValue({ affected: 0 });
    await expect(removeListItem(r(), 'list-1', 'item-1', 'u1')).rejects.toThrow('Item not found.');
    expect(repos.listItemEventRepository.insert).not.toHaveBeenCalled();
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

describe('serializeListItem overrides', () => {
  it('sorts under the override and keeps the default section', () => {
    const serialized = serializeListItem(row({}) as never, {
      iconKey: 'coffee',
      sectionKey: 'beverages',
    });
    expect(serialized).toMatchObject({
      sectionKey: 'beverages',
      defaultSectionKey: 'milk-cheese',
      iconKey: 'coffee',
    });
  });

  it('files a custom item without override under own-items', () => {
    const serialized = serializeListItem(
      row({ catalogItemKey: null, catalogItem: null, customItem: { id: 'c1', name: 'Kombucha' } }) as never,
    );
    expect(serialized).toMatchObject({ sectionKey: 'own-items', defaultSectionKey: 'own-items', iconKey: null });
  });
});

describe('setListItemOverride', () => {
  it('stores the icon for the item in the list, not on its list row', async () => {
    repos.listItemRepository.findOne.mockResolvedValue(row({}));
    repos.itemOverrideRepository.findOne.mockResolvedValue(null);
    const item = await setListItemOverride(r(), 'list-1', 'item-1', { iconKey: 'coffee' }, 'u1');
    expect(repos.itemOverrideRepository.findOne).toHaveBeenCalledWith({
      where: { shoppingListId: 'list-1', catalogItemKey: 'milk' },
    });
    expect(repos.itemOverrideRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        shoppingListId: 'list-1',
        catalogItemKey: 'milk',
        customItemId: null,
        iconKey: 'coffee',
        sectionKey: null,
      }),
    );
    expect(repos.listItemRepository.save).not.toHaveBeenCalled();
    expect(item).toMatchObject({ iconKey: 'coffee', sectionKey: 'milk-cheese' });
  });

  it('keys a custom item override by the custom item', async () => {
    repos.listItemRepository.findOne.mockResolvedValue(
      row({ catalogItemKey: null, catalogItem: null, customItemId: 'c1', customItem: { id: 'c1', name: 'Kombucha' } }),
    );
    repos.itemOverrideRepository.findOne.mockResolvedValue(null);
    const item = await setListItemOverride(r(), 'list-1', 'item-1', { sectionKey: 'beverages' }, 'u1');
    expect(repos.itemOverrideRepository.findOne).toHaveBeenCalledWith({
      where: { shoppingListId: 'list-1', customItemId: 'c1' },
    });
    expect(item).toMatchObject({ sectionKey: 'beverages', defaultSectionKey: 'own-items' });
  });

  it('keeps the other field when setting one', async () => {
    repos.listItemRepository.findOne.mockResolvedValue(row({}));
    repos.itemOverrideRepository.findOne.mockResolvedValue({
      id: 'o1',
      shoppingListId: 'list-1',
      catalogItemKey: 'milk',
      customItemId: null,
      iconKey: 'coffee',
      sectionKey: null,
    });
    const item = await setListItemOverride(r(), 'list-1', 'item-1', { sectionKey: 'beverages' }, 'u1');
    expect(item).toMatchObject({ iconKey: 'coffee', sectionKey: 'beverages' });
  });

  it('deletes the override once both fields are cleared', async () => {
    repos.listItemRepository.findOne.mockResolvedValue(row({}));
    repos.itemOverrideRepository.findOne.mockResolvedValue({
      id: 'o1',
      shoppingListId: 'list-1',
      catalogItemKey: 'milk',
      customItemId: null,
      iconKey: null,
      sectionKey: 'beverages',
    });
    const item = await setListItemOverride(r(), 'list-1', 'item-1', { sectionKey: null }, 'u1');
    expect(repos.itemOverrideRepository.delete).toHaveBeenCalledWith({ id: 'o1' });
    expect(repos.itemOverrideRepository.save).not.toHaveBeenCalled();
    expect(item.sectionKey).toBe('milk-cheese');
  });

  it('404s for an item of another list', async () => {
    repos.listItemRepository.findOne.mockResolvedValue(null);
    await expect(
      setListItemOverride(r(), 'list-1', 'item-1', { iconKey: 'coffee' }, 'u1'),
    ).rejects.toThrow('Item not found.');
  });
});

describe('section order writes', () => {
  it('replaces every row in one transaction and answers the saved order', async () => {
    const view = await replaceListSectionOrder(r(), 'list-1', ['milk-cheese', 'fruits-vegetables'], 'u1');
    expect(orderTx.delete).toHaveBeenCalledWith({ shoppingListId: 'list-1' });
    expect(orderTx.insert).toHaveBeenCalledWith([
      { shoppingListId: 'list-1', sectionKey: 'milk-cheese', position: 0 },
      { shoppingListId: 'list-1', sectionKey: 'fruits-vegetables', position: 1 },
    ]);
    expect(view).toEqual({ sectionKeys: ['milk-cheese', 'fruits-vegetables'] });
    expect(repos.sectionOrderRepository.find).not.toHaveBeenCalled();
  });

  it('reset deletes the list rows and answers the default order without own-items', async () => {
    const view = await resetListSectionOrder(r(), 'list-1', 'u1');
    expect(repos.sectionOrderRepository.delete).toHaveBeenCalledWith({ shoppingListId: 'list-1' });
    expect(view).toEqual({ sectionKeys: CATALOG_SECTIONS.map((section) => section.key) });
    expect(view.sectionKeys).not.toContain(OWN_ITEMS_SECTION_KEY);
    expect(repos.sectionOrderRepository.find).not.toHaveBeenCalled();
  });

  it('rejects non-members before writing', async () => {
    memberQuery.getOne.mockResolvedValue(null);
    await expect(replaceListSectionOrder(r(), 'list-1', [], 'u1')).rejects.toThrow(/not found/);
    expect(orderTx.insert).not.toHaveBeenCalled();
  });
});

describe('item history (ADR-0027)', () => {
  const event = (kind: string, source: string, userId: string | null = 'u1') => ({
    shoppingListId: 'list-1',
    catalogItemKey: 'milk',
    customItemId: null,
    kind,
    source,
    userId,
  });
  const events = () => repos.listItemEventRepository.insert.mock.calls.map(([logged]) => logged);

  beforeEach(() => {
    repos.catalogItemRepository.exists.mockResolvedValue(true);
  });

  it('logs a hand add that puts a new item to buy', async () => {
    repos.listItemRepository.findOne.mockResolvedValue(null);
    repos.listItemRepository.findOneOrFail.mockResolvedValue(row({ id: 'saved-id' }));
    await addListItem(r(), 'list-1', { catalogItemKey: 'milk' }, 'u1');
    expect(events()).toEqual([event('added', 'user')]);
  });

  it('logs a hand add that reopens a bought item', async () => {
    repos.listItemRepository.findOne.mockResolvedValue(row({ status: 'bought', source: 'dish' }));
    await addListItem(r(), 'list-1', { catalogItemKey: 'milk' }, 'u1');
    expect(events()).toEqual([event('added', 'user')]);
  });

  it('logs a hand add that claims a to-buy item of another source', async () => {
    repos.listItemRepository.findOne.mockResolvedValue(row({ source: 'recurring' }));
    await addListItem(r(), 'list-1', { catalogItemKey: 'milk' }, 'u1');
    expect(events()).toEqual([event('added', 'user')]);
  });

  it('logs nothing when a to-buy hand item is added again', async () => {
    repos.listItemRepository.findOne.mockResolvedValue(row({}));
    await addListItem(r(), 'list-1', { catalogItemKey: 'milk' }, 'u1');
    expect(events()).toEqual([]);
  });

  it('logs a buy with the reason the item was to buy', async () => {
    repos.listItemRepository.findOne.mockResolvedValue(row({ source: 'recurring' }));
    await setListItemStatus(r(), 'list-1', 'item-1', 'bought', 'u1');
    expect(events()).toEqual([event('bought', 'recurring')]);
  });

  it('logs no second buy for an item already bought', async () => {
    repos.listItemRepository.findOne.mockResolvedValue(row({ status: 'bought', lastBoughtAt: new Date() }));
    await setListItemStatus(r(), 'list-1', 'item-1', 'bought', 'u1');
    expect(events()).toEqual([]);
  });

  it('logs nothing when a concurrent request bought the item first', async () => {
    repos.listItemRepository.findOne.mockResolvedValue(row({}));
    repos.listItemRepository.update.mockResolvedValue({ affected: 0 });
    await setListItemStatus(r(), 'list-1', 'item-1', 'bought', 'u1');
    expect(events()).toEqual([]);
    expect(repos.listItemDishRepository.update).not.toHaveBeenCalled();
  });

  it('logs nothing when a concurrent request put the item back first', async () => {
    repos.listItemRepository.findOne.mockResolvedValue(
      row({ status: 'bought', lastBoughtAt: new Date(Date.now() - 60_000) }),
    );
    repos.listItemRepository.update.mockResolvedValue({ affected: 0 });
    await setListItemStatus(r(), 'list-1', 'item-1', 'to_buy', 'u1');
    expect(events()).toEqual([]);
    expect(repos.listItemDishRepository.update).not.toHaveBeenCalled();
  });

  it('logs the undo of a mistaken buy', async () => {
    repos.listItemRepository.findOne.mockResolvedValue(
      row({ status: 'bought', lastBoughtAt: new Date(Date.now() - 60_000) }),
    );
    await setListItemStatus(r(), 'list-1', 'item-1', 'to_buy', 'u1');
    expect(events()).toEqual([event('unbought', 'user')]);
  });

  it('logs a later put-back from Last used as a hand add', async () => {
    repos.listItemRepository.findOne.mockResolvedValue(
      row({ status: 'bought', source: 'recurring', lastBoughtAt: new Date(Date.now() - 10 * 60_000) }),
    );
    await setListItemStatus(r(), 'list-1', 'item-1', 'to_buy', 'u1');
    expect(events()).toEqual([event('added', 'user')]);
  });

  it('logs the removal of an item still to buy as "not finished yet"', async () => {
    repos.listItemRepository.findOne.mockResolvedValue(row({ source: 'recurring' }));
    repos.listItemRepository.delete.mockResolvedValue({ affected: 1 });
    await removeListItem(r(), 'list-1', 'item-1', 'u1');
    expect(events()).toEqual([event('removed', 'recurring')]);
  });

  it('logs nothing when a bought item is removed', async () => {
    repos.listItemRepository.findOne.mockResolvedValue(row({ status: 'bought' }));
    repos.listItemRepository.delete.mockResolvedValue({ affected: 1 });
    await removeListItem(r(), 'list-1', 'item-1', 'u1');
    expect(events()).toEqual([]);
  });
});
