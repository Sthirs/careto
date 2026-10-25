import { createJsonRequest, ensureBackendAvailable, registerUser, uniqueValue } from './helpers/api';

describe('GET /api/lists', () => {
  beforeAll(async () => {
    await ensureBackendAvailable();
  });

  it('returns the authenticated user lists', async () => {
    const registerResponse = await registerUser('lists-list');
    const shoppingListName = uniqueValue('road-trip');

    const createShoppingListResponse = await createJsonRequest<{ shoppingList: { id: string } }>('/api/lists', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${registerResponse.body.token}`,
      },
      body: JSON.stringify({ name: shoppingListName }),
    });

    expect(createShoppingListResponse.status).toBe(201);

    const response = await createJsonRequest<{
      shoppingLists: Array<{ id: string; name: string; imageUrl: string | null; memberCount: number; members: Array<{ email: string }> }>;
    }>('/api/lists', {
      headers: {
        Authorization: `Bearer ${registerResponse.body.token}`,
      },
    });

    expect(response.status).toBe(200);
    expect(response.body.shoppingLists).toHaveLength(1);
    expect(response.body.shoppingLists[0]).toMatchObject({
      id: createShoppingListResponse.body.shoppingList.id,
      name: shoppingListName,
      imageUrl: null,
      memberCount: 1,
    });
    expect(response.body.shoppingLists[0].members[0].email).toBe(registerResponse.body.user.email);
  });

  it('rejects unauthenticated access', async () => {
    const response = await createJsonRequest<{ message: string }>('/api/lists');

    expect(response.status).toBe(401);
    expect(response.body.message).toMatch(/missing bearer token/i);
  });
});
