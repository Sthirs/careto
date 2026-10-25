/**
 * Unit tests for ShoppingListService — pins the serialized shape of the list
 * read and write paths.
 *
 * Mocking strategy: mirrors `tests/oauth/oauth-service.test.ts` — replace
 * `../src/db/data-source` with an in-memory fake dispatched by
 * `entity.name` (List/User/Invitation), using plain `vi.fn()` repository
 * methods configured per test via `mockResolvedValueOnce`. Chainable
 * query-builder methods (`innerJoin`/`leftJoinAndSelect`/`where`/`orderBy`)
 * use `mockReturnThis()` re-armed in `beforeEach` after `vi.clearAllMocks()`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ALICE = {
  id: 'user-alice',
  displayName: 'Alice',
  email: 'alice@test.local',
  imageUrl: null as string | null,
};
const BOB = {
  id: 'user-bob',
  displayName: 'Bob',
  email: 'bob@test.local',
  imageUrl: 'data:image/webp;base64,AAAA' as string | null,
};

const SHOPPING_LIST = {
  id: 'list-1',
  name: 'Weekly Groceries',
  imageUrl: null as string | null,
  members: [ALICE, BOB],
};

const shoppingListQueryBuilder = {
  innerJoin: vi.fn(),
  leftJoinAndSelect: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  getOne: vi.fn(),
  getMany: vi.fn(),
};

const shoppingListRepo = {
  createQueryBuilder: vi.fn(() => shoppingListQueryBuilder),
  create: vi.fn((data: Record<string, unknown>) => ({
    id: 'list-created-id',
    imageUrl: null,
    ...data,
  })),
  save: vi.fn(async (g: unknown) => g),
};

const userRepo = {
  findOne: vi.fn(),
};

const invitationRepo = {
  find: vi.fn(async () => [] as unknown[]),
};

function dispatchRepo(entity: { name: string }) {
  switch (entity.name) {
    case 'ShoppingList':
      return shoppingListRepo;
    case 'User':
      return userRepo;
    case 'Invitation':
      return invitationRepo;
    default:
      throw new Error(
        `Unmocked entity in shoppingListService.test.ts: ${entity.name}`,
      );
  }
}

vi.mock('../src/db/data-source', () => ({
  AppDataSource: {
    getRepository: dispatchRepo,
    transaction: vi.fn(),
  },
  initializeDatabase: vi.fn(async () => undefined),
}));

// Import AFTER the mock so ShoppingListService receives the stubbed data-source.
import { ShoppingListService } from '../src/services/shoppingListService';

describe('ShoppingListService', () => {
  let service: ShoppingListService;

  beforeEach(() => {
    vi.clearAllMocks();
    shoppingListQueryBuilder.innerJoin.mockReturnThis();
    shoppingListQueryBuilder.leftJoinAndSelect.mockReturnThis();
    shoppingListQueryBuilder.where.mockReturnThis();
    shoppingListQueryBuilder.orderBy.mockReturnThis();
    invitationRepo.find.mockResolvedValue([]);
    service = new ShoppingListService();
  });

  it('createShoppingListForUser: serializes the new list with its creator as the only member', async () => {
    userRepo.findOne.mockResolvedValueOnce(ALICE);

    const result = await service.createShoppingListForUser(ALICE.id, 'New List');

    expect(Object.keys(result).sort()).toEqual(
      ['id', 'name', 'imageUrl', 'memberCount', 'members'].sort(),
    );
    expect(result.name).toBe('New List');
    expect(result.imageUrl).toBeNull();
    expect(result.memberCount).toBe(1);
    expect(result.members).toEqual([
      {
        id: ALICE.id,
        displayName: ALICE.displayName,
        email: ALICE.email,
        imageUrl: null,
      },
    ]);
  });

  it('createShoppingListForUser: throws when the authenticated user no longer exists', async () => {
    userRepo.findOne.mockResolvedValueOnce(null);

    await expect(service.createShoppingListForUser('ghost', 'X')).rejects.toThrow(
      'Authenticated user not found.',
    );
  });

  it('getShoppingListsForUser: serializes every list the user belongs to', async () => {
    shoppingListQueryBuilder.getMany.mockResolvedValueOnce([SHOPPING_LIST]);

    const result = await service.getShoppingListsForUser(ALICE.id);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: SHOPPING_LIST.id,
      name: SHOPPING_LIST.name,
      memberCount: 2,
    });
    expect(result[0].members[1].imageUrl).toBe(BOB.imageUrl);
  });

  it('getShoppingListByIdForUser: returns null for a non-member', async () => {
    shoppingListQueryBuilder.getOne.mockResolvedValueOnce(null);

    await expect(
      service.getShoppingListByIdForUser(SHOPPING_LIST.id, 'stranger'),
    ).resolves.toBeNull();
  });

  it('getShoppingListByIdForUser: includes pending invitations by email only', async () => {
    shoppingListQueryBuilder.getOne.mockResolvedValueOnce(SHOPPING_LIST);
    invitationRepo.find.mockResolvedValueOnce([
      {
        id: 'inv-1',
        inviteeEmail: 'carol@test.local',
        inviteeId: 'user-carol',
        createdAt: new Date('2026-02-01T10:00:00.000Z'),
      },
    ]);

    const result = await service.getShoppingListByIdForUser(SHOPPING_LIST.id, ALICE.id);

    expect(result?.pendingInvitations).toEqual([
      {
        id: 'inv-1',
        email: 'carol@test.local',
        createdAt: '2026-02-01T10:00:00.000Z',
      },
    ]);
  });

  it('updateShoppingList: renames a list the user belongs to', async () => {
    shoppingListQueryBuilder.getOne.mockResolvedValueOnce({ ...SHOPPING_LIST });

    const result = await service.updateShoppingList(SHOPPING_LIST.id, 'Renamed', ALICE.id);

    expect(result.name).toBe('Renamed');
  });

  it('updateShoppingList: rejects a non-member', async () => {
    shoppingListQueryBuilder.getOne.mockResolvedValueOnce(null);

    await expect(
      service.updateShoppingList(SHOPPING_LIST.id, 'Renamed', 'stranger'),
    ).rejects.toThrow('List not found or you are not a member.');
  });
});
