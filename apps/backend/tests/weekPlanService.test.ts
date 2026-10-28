/**
 * Unit tests for the week plan operations, with fake repositories passed in
 * directly, as in `dishService.test.ts`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db/data-source', () => ({ AppDataSource: { getRepository: vi.fn() } }));
vi.mock('../src/services/dish/dishListing', () => ({ addDishToList: vi.fn() }));

import { addDishToList } from '../src/services/dish/dishListing';
import {
  addPlanToList,
  getPlan,
  replacePlan,
  setSlot,
} from '../src/services/weekPlan/weekPlanOperations';
import type { WeekPlanRepositories } from '../src/services/weekPlan/weekPlanRepositories';

const memberQuery = {
  innerJoin: vi.fn().mockReturnThis(),
  leftJoinAndSelect: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  getOne: vi.fn(),
};

const repo = () => ({
  find: vi.fn(async () => [] as unknown[]),
  count: vi.fn(async () => 1),
  delete: vi.fn(async () => ({ affected: 1 })),
  insert: vi.fn(async () => undefined),
  upsert: vi.fn(async () => undefined),
});

let slots: ReturnType<typeof repo>;
let dishes: ReturnType<typeof repo>;
let r: WeekPlanRepositories;

beforeEach(() => {
  vi.clearAllMocks();
  memberQuery.innerJoin.mockReturnThis();
  memberQuery.leftJoinAndSelect.mockReturnThis();
  memberQuery.where.mockReturnThis();
  memberQuery.getOne.mockResolvedValue({ id: 'list-1', members: [] });
  slots = repo();
  dishes = repo();
  r = {
    shoppingListRepository: { createQueryBuilder: vi.fn(() => memberQuery) },
    weekSlotRepository: slots,
    dishRepository: dishes,
    replaceSlots: vi.fn(async (work: (table: unknown) => Promise<void>) => work(slots)),
  } as unknown as WeekPlanRepositories;
});

describe('getPlan', () => {
  it('returns the slots Monday lunch first', async () => {
    slots.find.mockResolvedValue([
      { weekday: 2, meal: 'lunch', dishId: 'd3' },
      { weekday: 1, meal: 'dinner', dishId: 'd2' },
      { weekday: 1, meal: 'lunch', dishId: 'd1' },
    ]);
    const plan = await getPlan(r, 'list-1', 'u1');
    expect(plan.slots.map((s) => s.dishId)).toEqual(['d1', 'd2', 'd3']);
  });

  it('rejects non-members', async () => {
    memberQuery.getOne.mockResolvedValue(null);
    await expect(getPlan(r, 'list-1', 'u1')).rejects.toThrow(/not a member/);
  });
});

describe('setSlot', () => {
  it('upserts a dish of the list into the slot', async () => {
    await setSlot(r, 'list-1', { weekday: 3, meal: 'dinner', dishId: 'd1' }, 'u1');
    expect(slots.upsert).toHaveBeenCalledWith(
      { shoppingListId: 'list-1', weekday: 3, meal: 'dinner', dishId: 'd1' },
      { conflictPaths: ['shoppingListId', 'weekday', 'meal'] },
    );
  });

  it('empties the slot for a null dish', async () => {
    await setSlot(r, 'list-1', { weekday: 3, meal: 'dinner', dishId: null }, 'u1');
    expect(slots.delete).toHaveBeenCalledWith({ shoppingListId: 'list-1', weekday: 3, meal: 'dinner' });
    expect(slots.upsert).not.toHaveBeenCalled();
  });

  it('rejects a dish of another list', async () => {
    dishes.count.mockResolvedValue(0);
    await expect(
      setSlot(r, 'list-1', { weekday: 3, meal: 'dinner', dishId: 'other' }, 'u1'),
    ).rejects.toThrow('Dish not found.');
    expect(slots.upsert).not.toHaveBeenCalled();
  });
});

describe('replacePlan', () => {
  it('clears the plan for an empty list of slots', async () => {
    await replacePlan(r, 'list-1', [], 'u1');
    expect(slots.delete).toHaveBeenCalledWith({ shoppingListId: 'list-1' });
    expect(slots.insert).not.toHaveBeenCalled();
  });

  it('writes the given slots back, checking each distinct dish once', async () => {
    dishes.count.mockResolvedValue(1);
    await replacePlan(
      r,
      'list-1',
      [
        { weekday: 1, meal: 'lunch', dishId: 'd1' },
        { weekday: 2, meal: 'dinner', dishId: 'd1' },
      ],
      'u1',
    );
    expect(slots.insert).toHaveBeenCalledWith([
      { weekday: 1, meal: 'lunch', dishId: 'd1', shoppingListId: 'list-1' },
      { weekday: 2, meal: 'dinner', dishId: 'd1', shoppingListId: 'list-1' },
    ]);
  });
});

describe('addPlanToList', () => {
  it('adds each planned dish once through the dish service', async () => {
    slots.find.mockResolvedValue([
      { weekday: 1, meal: 'lunch', dishId: 'd1' },
      { weekday: 2, meal: 'dinner', dishId: 'd2' },
      { weekday: 4, meal: 'lunch', dishId: 'd1' },
    ]);
    await addPlanToList(r, 'list-1', 'u1');
    expect(vi.mocked(addDishToList).mock.calls.map((call) => call[2])).toEqual(['d1', 'd2']);
  });
});
