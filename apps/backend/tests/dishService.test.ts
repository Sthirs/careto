/**
 * Unit tests for the dish domain modules, with fake repositories passed in
 * directly, as in `listItemService.test.ts`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db/data-source', () => ({ AppDataSource: { getRepository: vi.fn() } }));

import { addDishToList, removeDishFromList } from '../src/services/dish/dishListing';
import { createDish, deleteDish, setDishPause } from '../src/services/dish/dishMutations';
import { listDishes } from '../src/services/dish/dishQueries';
import type { DishRepositories } from '../src/services/dish/dishRepositories';

const memberQuery = {
  innerJoin: vi.fn().mockReturnThis(),
  leftJoinAndSelect: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  getOne: vi.fn(),
};

const repo = () => ({
  find: vi.fn(async () => []),
  findOne: vi.fn(),
  findOneOrFail: vi.fn(),
  exists: vi.fn(async () => true),
  save: vi.fn(async (row: unknown) =>
    Array.isArray(row) ? row : { id: 'saved-id', ...(row as Record<string, unknown>) },
  ),
  create: vi.fn((row: Record<string, unknown>) => row),
  delete: vi.fn(async () => ({ affected: 1 })),
  update: vi.fn(async () => ({ affected: 1 })),
  insert: vi.fn(),
  findOneByOrFail: vi.fn(),
  count: vi.fn(async () => 0),
});

type FakeRepos = Record<string, ReturnType<typeof repo>>;
let repos: FakeRepos;
const r = () => repos as unknown as DishRepositories;

const ingredient = (key: string, position: number) => ({
  id: `ing-${key}`,
  catalogItemKey: key,
  catalogItem: { key, sectionKey: 'pantry' },
  customItemId: null,
  customItem: null,
  position,
});

const dish = (overrides: Record<string, unknown> = {}) => ({
  id: 'dish-1',
  name: 'Lasagna',
  imageUrl: null,
  pausedUntil: null,
  lastAddedAt: new Date('2026-09-01T00:00:00Z'),
  previousLastAddedAt: null,
  ingredients: [ingredient('pasta', 0), ingredient('ground-meat', 1)],
  ...overrides,
});

const listItem = (overrides: Record<string, unknown>) => ({
  id: 'item-1',
  status: 'to_buy',
  source: 'dish',
  catalogItemKey: 'pasta',
  catalogItem: { key: 'pasta', sectionKey: 'pantry' },
  customItemId: null,
  customItem: null,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  memberQuery.innerJoin.mockReturnThis();
  memberQuery.leftJoinAndSelect.mockReturnThis();
  memberQuery.where.mockReturnThis();
  memberQuery.getOne.mockResolvedValue({ id: 'list-1', members: [] });
  repos = {
    shoppingListRepository: { createQueryBuilder: vi.fn(() => memberQuery) },
    catalogItemRepository: repo(),
    customItemRepository: repo(),
    listItemRepository: repo(),
    listItemDishRepository: repo(),
    dishRepository: repo(),
    dishIngredientRepository: repo(),
  } as unknown as FakeRepos;
  (repos as unknown as Record<string, unknown>).transaction = vi.fn(async (work) =>
    work({ dishRepository: repos.dishRepository, dishIngredientRepository: repos.dishIngredientRepository }),
  );
});

describe('listDishes', () => {
  it('marks a dish in the list only through an open link to a to-buy item', async () => {
    repos.dishRepository.find.mockResolvedValue([dish(), dish({ id: 'dish-2', name: 'Soup' })] as never);
    repos.listItemDishRepository.find.mockResolvedValue([
      { dishId: 'dish-1', listItem: { status: 'to_buy' } },
      { dishId: 'dish-2', listItem: { status: 'bought' } },
    ] as never);

    const dishes = await listDishes(r(), 'list-1', 'u1');

    expect(dishes.map((d) => [d.id, d.inList])).toEqual([
      ['dish-1', true],
      ['dish-2', false],
    ]);
    expect(dishes[0].ingredients.map((i) => i.catalogItemKey)).toEqual(['pasta', 'ground-meat']);
  });

  it('rejects non-members', async () => {
    memberQuery.getOne.mockResolvedValue(null);
    await expect(listDishes(r(), 'list-1', 'u1')).rejects.toThrow(/not found/);
  });
});

describe('createDish', () => {
  it('saves the ingredients in order and drops repeats', async () => {
    repos.dishRepository.findOne.mockResolvedValue(dish() as never);

    await createDish(
      r(),
      'list-1',
      {
        name: 'Lasagna',
        ingredients: [{ catalogItemKey: 'pasta' }, { catalogItemKey: 'ground-meat' }, { catalogItemKey: 'pasta' }],
      },
      'u1',
    );

    expect(repos.dishIngredientRepository.save).toHaveBeenCalledWith([
      expect.objectContaining({ dishId: 'saved-id', catalogItemKey: 'pasta', position: 0 }),
      expect.objectContaining({ dishId: 'saved-id', catalogItemKey: 'ground-meat', position: 1 }),
    ]);
  });
});

describe('addDishToList', () => {
  beforeEach(() => {
    repos.listItemDishRepository.exists.mockResolvedValue(false);
  });

  it('puts new ingredients on the list as dish items and links them', async () => {
    repos.dishRepository.findOne.mockResolvedValue(dish() as never);
    repos.listItemRepository.findOne.mockResolvedValue(null);
    repos.listItemRepository.findOneOrFail.mockImplementation(async () => listItem({}) as never);

    const result = await addDishToList(r(), 'list-1', 'dish-1', 'u1');

    expect(repos.listItemRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ catalogItemKey: 'pasta', source: 'dish', status: 'to_buy' }),
    );
    expect(repos.listItemDishRepository.insert).toHaveBeenCalledWith({
      listItemId: 'item-1',
      dishId: 'dish-1',
      fulfilledAt: null,
    });
    expect(repos.dishRepository.update).toHaveBeenCalledWith(
      { id: 'dish-1', lastAddedAt: new Date('2026-09-01T00:00:00Z') },
      { lastAddedAt: expect.any(Date), previousLastAddedAt: new Date('2026-09-01T00:00:00Z') },
    );
    expect(result.lastAddedAt).not.toBe('2026-09-01T00:00:00.000Z');
  });

  it('links an item a member already added without changing its source', async () => {
    repos.dishRepository.findOne.mockResolvedValue(dish({ ingredients: [ingredient('pasta', 0)] }) as never);
    repos.listItemRepository.findOne.mockResolvedValue(listItem({ source: 'user' }) as never);

    await addDishToList(r(), 'list-1', 'dish-1', 'u1');

    expect(repos.listItemRepository.create).not.toHaveBeenCalled();
    expect(repos.listItemRepository.save).not.toHaveBeenCalled();
    expect(repos.listItemDishRepository.insert).toHaveBeenCalledWith(
      expect.objectContaining({ listItemId: 'item-1', dishId: 'dish-1' }),
    );
  });

  it('puts a bought ingredient back to buy', async () => {
    repos.dishRepository.findOne.mockResolvedValue(dish({ ingredients: [ingredient('pasta', 0)] }) as never);
    repos.listItemRepository.findOne.mockResolvedValue(listItem({ status: 'bought' }) as never);

    await addDishToList(r(), 'list-1', 'dish-1', 'u1');

    expect(repos.listItemRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'to_buy', source: 'dish' }),
    );
  });

  it('keeps an open link and the add dates when the dish is already in the list', async () => {
    repos.dishRepository.findOne.mockResolvedValue(dish({ ingredients: [ingredient('pasta', 0)] }) as never);
    repos.listItemRepository.findOne.mockResolvedValue(listItem({}) as never);
    repos.listItemDishRepository.find.mockResolvedValue([
      { dishId: 'dish-1', listItem: listItem({}) },
    ] as never);
    repos.listItemDishRepository.exists.mockResolvedValue(true);

    const result = await addDishToList(r(), 'list-1', 'dish-1', 'u1');

    expect(repos.listItemDishRepository.insert).not.toHaveBeenCalled();
    expect(repos.listItemDishRepository.save).not.toHaveBeenCalled();
    expect(repos.dishRepository.update).not.toHaveBeenCalled();
    expect(result.lastAddedAt).toBe('2026-09-01T00:00:00.000Z');
  });

  it('takes the dates a concurrent add wrote', async () => {
    repos.dishRepository.findOne.mockResolvedValue(dish({ ingredients: [ingredient('pasta', 0)] }) as never);
    repos.listItemRepository.findOne.mockResolvedValue(listItem({}) as never);
    repos.dishRepository.update.mockResolvedValue({ affected: 0 });
    repos.dishRepository.findOneByOrFail.mockResolvedValue({
      lastAddedAt: new Date('2026-10-26T10:00:00Z'),
      previousLastAddedAt: new Date('2026-09-01T00:00:00Z'),
    });

    const result = await addDishToList(r(), 'list-1', 'dish-1', 'u1');

    expect(result.lastAddedAt).toBe('2026-10-26T10:00:00.000Z');
  });

  it('404s a dish of another list', async () => {
    repos.dishRepository.findOne.mockResolvedValue(null);
    await expect(addDishToList(r(), 'list-1', 'dish-x', 'u1')).rejects.toThrow('Dish not found.');
  });
});

describe('removeDishFromList', () => {
  it('takes off only to-buy dish items that no other dish still needs', async () => {
    repos.dishRepository.findOne.mockResolvedValue(
      dish({ previousLastAddedAt: new Date('2026-08-01T00:00:00Z') }) as never,
    );
    repos.listItemDishRepository.find.mockResolvedValue([
      { dishId: 'dish-1', listItem: listItem({ id: 'dish-only' }) },
      { dishId: 'dish-1', listItem: listItem({ id: 'shared' }) },
      { dishId: 'dish-1', listItem: listItem({ id: 'by-hand', source: 'user' }) },
      {
        dishId: 'dish-1',
        listItem: listItem({ id: 'reopened', lastBoughtAt: new Date('2026-10-01T00:00:00Z') }),
      },
    ] as never);
    repos.listItemDishRepository.count.mockImplementation(async (options: unknown) => {
      const where = (options as { where: { listItemId: string } }).where;
      return where.listItemId === 'shared' ? 1 : 0;
    });

    const result = await removeDishFromList(r(), 'list-1', 'dish-1', 'u1');

    expect(repos.listItemDishRepository.delete).toHaveBeenCalledWith(
      expect.objectContaining({ dishId: 'dish-1' }),
    );
    expect(repos.listItemRepository.delete).toHaveBeenCalledTimes(1);
    expect(repos.listItemRepository.delete).toHaveBeenCalledWith({ id: 'dish-only', shoppingListId: 'list-1' });
    expect(repos.listItemRepository.update).toHaveBeenCalledWith({ id: 'reopened' }, { status: 'bought' });
    expect(repos.dishRepository.update).toHaveBeenCalledWith(
      { id: 'dish-1' },
      { lastAddedAt: new Date('2026-08-01T00:00:00Z'), previousLastAddedAt: null },
    );
    expect(result.lastAddedAt).toBe('2026-08-01T00:00:00.000Z');
  });

  it('changes nothing when the dish is not in the list', async () => {
    repos.dishRepository.findOne.mockResolvedValue(dish() as never);
    repos.listItemDishRepository.find.mockResolvedValue([]);

    await removeDishFromList(r(), 'list-1', 'dish-1', 'u1');

    expect(repos.listItemDishRepository.delete).not.toHaveBeenCalled();
    expect(repos.dishRepository.update).not.toHaveBeenCalled();
  });
});

describe('setDishPause / deleteDish', () => {
  it('stores the pause date', async () => {
    repos.dishRepository.findOne.mockResolvedValue(dish() as never);
    const result = await setDishPause(r(), 'list-1', 'dish-1', '2026-11-09', 'u1');
    expect(repos.dishRepository.update).toHaveBeenCalledWith({ id: 'dish-1' }, { pausedUntil: '2026-11-09' });
    expect(result.pausedUntil).toBe('2026-11-09');
  });

  it('404s when deleting a dish that is not there', async () => {
    repos.dishRepository.delete.mockResolvedValue({ affected: 0 });
    await expect(deleteDish(r(), 'list-1', 'dish-1', 'u1')).rejects.toThrow('Dish not found.');
  });
});
