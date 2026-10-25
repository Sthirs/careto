import { createJsonRequest, ensureBackendAvailable, registerUser, uniqueValue } from './helpers/api';

describe('POST /api/lists', () => {
  beforeAll(async () => {
    await ensureBackendAvailable();
  });

  it('creates a list and associates the authenticated user', async () => {
    const registerResponse = await registerUser('lists-create');
    const shoppingListName = uniqueValue('weekend-house');

    const createResponse = await createJsonRequest<{
      shoppingList: {
        id: string;
        name: string;
        imageUrl: string | null;
        memberCount: number;
        members: Array<{ id: string; email: string; displayName: string }>;
      };
    }>('/api/lists', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${registerResponse.body.token}`,
      },
      body: JSON.stringify({ name: shoppingListName }),
    });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.shoppingList).toMatchObject({
      name: shoppingListName,
      imageUrl: null,
      memberCount: 1,
    });
    expect(createResponse.body.shoppingList.members).toEqual([
      {
        id: registerResponse.body.user.id,
        email: registerResponse.body.user.email,
        displayName: registerResponse.body.user.displayName,
        imageUrl: null,
      },
    ]);
  });

  it('rejects unauthenticated list creation', async () => {
    const response = await createJsonRequest<{ message: string }>('/api/lists', {
      method: 'POST',
      body: JSON.stringify({ name: uniqueValue('sneaky-list') }),
    });

    expect(response.status).toBe(401);
    expect(response.body.message).toMatch(/missing bearer token/i);
  });

  it('rejects empty list name', async () => {
    const registerResponse = await registerUser('lists-empty-name');

    const response = await createJsonRequest<{ message: string }>('/api/lists', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${registerResponse.body.token}`,
      },
      body: JSON.stringify({ name: '   ' }),
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/list name is required/i);
  });
});
