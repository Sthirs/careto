/**
 * Path ids that are not UUIDs can never name a row. Before the route-level
 * guard they reached Postgres and came back as a 500 HTML page carrying a
 * stack trace (GET /api/lists/:id) or as a 400 echoing the raw
 * `invalid input syntax for type uuid` error. Every list route must answer
 * them as a clean 404 JSON — and still demand authentication first.
 */
import { createJsonRequest, ensureBackendAvailable } from './helpers/api';
import { bearer, createSoloShoppingList } from './helpers/lists';

const BAD_ID = 'not-a-uuid';

describe('malformed path ids on /api/lists routes', () => {
  let token: string;
  let shoppingListId: string;

  beforeAll(async () => {
    await ensureBackendAvailable();
    const shoppingList = await createSoloShoppingList('malformed-ids');
    token = shoppingList.owner.token;
    shoppingListId = shoppingList.shoppingListId;
  });

  const cases = (): Array<[string, string, string]> => [
    ['GET', `/api/lists/${BAD_ID}`, 'List not found.'],
    ['PATCH', `/api/lists/${BAD_ID}`, 'List not found.'],
    ['POST', `/api/lists/${BAD_ID}/members`, 'List not found.'],
    ['POST', `/api/lists/${shoppingListId}/invitations/${BAD_ID}/accept`, 'Invitation not found.'],
    ['POST', `/api/lists/${shoppingListId}/invitations/${BAD_ID}/decline`, 'Invitation not found.'],
    ['DELETE', `/api/lists/${shoppingListId}/invitations/${BAD_ID}`, 'Invitation not found.'],
    ['DELETE', `/api/lists/${shoppingListId}/members/${BAD_ID}`, 'User is not a member of this list.'],
  ];

  it('answers every route with 404 JSON and never leaks a database error', async () => {
    for (const [method, path, message] of cases()) {
      const response = await createJsonRequest<{ message: string }>(path, {
        method,
        headers: bearer(token),
        body: method === 'GET' ? undefined : JSON.stringify({ name: 'x', email: 'x@example.com', amount: 1 }),
      });

      expect({ method, path, status: response.status, body: response.body }).toEqual({
        method,
        path,
        status: 404,
        body: { message },
      });
    }
  });

  it('still answers 401 first for an unauthenticated caller', async () => {
    const response = await createJsonRequest(`/api/lists/${BAD_ID}`);

    expect(response.status).toBe(401);
  });
});
