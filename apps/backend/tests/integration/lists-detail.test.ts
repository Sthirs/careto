import { createJsonRequest, ensureBackendAvailable, registerUser, uniqueValue } from './helpers/api';

describe('GET /api/lists/:id', () => {
  beforeAll(async () => {
    await ensureBackendAvailable();
  });

  it('returns a list with its details for an authorized member', async () => {
    const registerResponse = await registerUser('lists-detail');
    const shoppingListName = uniqueValue('vacation-budget');

    const createShoppingListResponse = await createJsonRequest<{ shoppingList: { id: string } }>('/api/lists', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${registerResponse.body.token}`,
      },
      body: JSON.stringify({ name: shoppingListName }),
    });

    expect(createShoppingListResponse.status).toBe(201);
    const shoppingListId = createShoppingListResponse.body.shoppingList.id;

    const response = await createJsonRequest<{
      shoppingList: {
        id: string;
        name: string;
        imageUrl: string | null;
        memberCount: number;
        members: Array<{ id: string; email: string; displayName: string }>;
      };
    }>(`/api/lists/${shoppingListId}`, {
      headers: {
        Authorization: `Bearer ${registerResponse.body.token}`,
      },
    });

    expect(response.status).toBe(200);
    expect(response.body.shoppingList).toMatchObject({
      id: shoppingListId,
      name: shoppingListName,
      imageUrl: null,
      memberCount: 1,
    });
    expect(response.body.shoppingList.members).toEqual([
      {
        id: registerResponse.body.user.id,
        email: registerResponse.body.user.email,
        displayName: registerResponse.body.user.displayName,
        imageUrl: null,
      },
    ]);
  });

  it('rejects unauthenticated access', async () => {
    const registerResponse = await registerUser('lists-detail-unauth');
    const shoppingListName = uniqueValue('secret-list');

    const createShoppingListResponse = await createJsonRequest<{ shoppingList: { id: string } }>('/api/lists', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${registerResponse.body.token}`,
      },
      body: JSON.stringify({ name: shoppingListName }),
    });

    expect(createShoppingListResponse.status).toBe(201);
    const shoppingListId = createShoppingListResponse.body.shoppingList.id;

    const response = await createJsonRequest<{ message: string }>(`/api/lists/${shoppingListId}`);

    expect(response.status).toBe(401);
    expect(response.body.message).toMatch(/missing bearer token/i);
  });

  it('returns 404 for non-existent list', async () => {
    const registerResponse = await registerUser('lists-detail-notfound');
    const fakeShoppingListId = '00000000-0000-0000-0000-000000000000';

    const response = await createJsonRequest<{ message: string }>(`/api/lists/${fakeShoppingListId}`, {
      headers: {
        Authorization: `Bearer ${registerResponse.body.token}`,
      },
    });

    expect(response.status).toBe(404);
    expect(response.body.message).toMatch(/list not found/i);
  });

  it('rejects access by non-member users', async () => {
    const user1Response = await registerUser('lists-detail-member');
    const user2Response = await registerUser('lists-detail-nonmember');
    const shoppingListName = uniqueValue('exclusive-list');

    const createShoppingListResponse = await createJsonRequest<{ shoppingList: { id: string } }>('/api/lists', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${user1Response.body.token}`,
      },
      body: JSON.stringify({ name: shoppingListName }),
    });

    expect(createShoppingListResponse.status).toBe(201);
    const shoppingListId = createShoppingListResponse.body.shoppingList.id;

    const response = await createJsonRequest<{ message: string }>(`/api/lists/${shoppingListId}`, {
      headers: {
        Authorization: `Bearer ${user2Response.body.token}`,
      },
    });

    expect(response.status).toBe(404);
    expect(response.body.message).toMatch(/list not found/i);
  });
});
