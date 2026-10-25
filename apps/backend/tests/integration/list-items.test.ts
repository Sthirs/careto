import { createJsonRequest, ensureBackendAvailable } from './helpers/api';
import { bearer, createSoloShoppingList, newUser, UNKNOWN_ID } from './helpers/lists';

type Item = {
  id: string;
  status: 'to_buy' | 'bought';
  lastBoughtAt: string | null;
  catalogItemKey: string | null;
  customItem: { id: string; name: string } | null;
  sectionKey: string;
};
type ItemsView = { sectionOrder: string[]; items: Item[]; customItems: Array<{ id: string; name: string }> };

const itemsPath = (shoppingListId: string) => `/api/lists/${shoppingListId}/items`;

const addItem = (token: string, shoppingListId: string, body: unknown) =>
  createJsonRequest<{ item: Item; message?: string }>(itemsPath(shoppingListId), {
    method: 'POST',
    headers: bearer(token),
    body: JSON.stringify(body),
  });

const getItems = (token: string, shoppingListId: string) =>
  createJsonRequest<ItemsView>(itemsPath(shoppingListId), { headers: bearer(token) });

describe('list items API', () => {
  beforeAll(async () => {
    await ensureBackendAvailable();
  });

  it('serves the default catalog by key', async () => {
    const user = await newUser('catalog');
    const response = await createJsonRequest<{
      sections: Array<{ key: string }>;
      items: Array<{ key: string; sectionKey: string }>;
    }>('/api/catalog', { headers: bearer(user.token) });

    expect(response.status).toBe(200);
    expect(response.body.sections[0]).toEqual({ key: 'fruits-vegetables' });
    expect(response.body.sections.at(-1)).toEqual({ key: 'own-items' });
    expect(response.body.items).toContainEqual({ key: 'pineapple', sectionKey: 'fruits-vegetables' });
  });

  it('adds, buys, re-adds and removes a catalog item', async () => {
    const { shoppingListId, owner } = await createSoloShoppingList('items-flow');

    const added = await addItem(owner.token, shoppingListId, { catalogItemKey: 'pineapple' });
    expect(added.status).toBe(201);
    expect(added.body.item).toMatchObject({ catalogItemKey: 'pineapple', status: 'to_buy', sectionKey: 'fruits-vegetables' });

    const bought = await createJsonRequest<{ item: Item }>(`${itemsPath(shoppingListId)}/${added.body.item.id}`, {
      method: 'PATCH',
      headers: bearer(owner.token),
      body: JSON.stringify({ status: 'bought' }),
    });
    expect(bought.status).toBe(200);
    expect(bought.body.item.status).toBe('bought');
    expect(bought.body.item.lastBoughtAt).not.toBeNull();

    const again = await addItem(owner.token, shoppingListId, { catalogItemKey: 'pineapple' });
    expect(again.status).toBe(200);
    expect(again.body.item).toMatchObject({ id: added.body.item.id, status: 'to_buy' });

    const removed = await createJsonRequest(`${itemsPath(shoppingListId)}/${added.body.item.id}`, {
      method: 'DELETE',
      headers: bearer(owner.token),
    });
    expect(removed.status).toBe(204);
    expect((await getItems(owner.token, shoppingListId)).body.items).toEqual([]);
  });

  it('keeps custom items per list and reuses them by name', async () => {
    const first = await createSoloShoppingList('items-custom-a');
    const second = await createSoloShoppingList('items-custom-b');

    const created = await addItem(first.owner.token, first.shoppingListId, { customName: "Nonna's sauce" });
    expect(created.status).toBe(201);
    expect(created.body.item).toMatchObject({ catalogItemKey: null, sectionKey: 'own-items' });

    const reused = await addItem(first.owner.token, first.shoppingListId, { customName: "  nonna's SAUCE " });
    expect(reused.status).toBe(200);
    expect(reused.body.item.id).toBe(created.body.item.id);

    const view = (await getItems(first.owner.token, first.shoppingListId)).body;
    expect(view.customItems).toEqual([created.body.item.customItem]);
    expect(view.sectionOrder.at(-1)).toBe('own-items');

    // Another list cannot use it.
    const foreign = await addItem(second.owner.token, second.shoppingListId, {
      customItemId: created.body.item.customItem!.id,
    });
    expect(foreign.status).toBe(404);
    expect((await getItems(second.owner.token, second.shoppingListId)).body.customItems).toEqual([]);
  });

  it('validates the add body', async () => {
    const { shoppingListId, owner } = await createSoloShoppingList('items-invalid');

    expect((await addItem(owner.token, shoppingListId, {})).status).toBe(400);
    expect((await addItem(owner.token, shoppingListId, { catalogItemKey: 'milk', customName: 'x' })).status).toBe(400);
    expect((await addItem(owner.token, shoppingListId, { customName: ' ' })).status).toBe(400);
    expect((await addItem(owner.token, shoppingListId, { catalogItemKey: 'no-such-item' })).status).toBe(404);
  });

  it('requires authentication and membership', async () => {
    const { shoppingListId, owner } = await createSoloShoppingList('items-access');
    const outsider = await newUser('items-outsider');
    const added = await addItem(owner.token, shoppingListId, { catalogItemKey: 'milk' });

    expect((await createJsonRequest(itemsPath(shoppingListId))).status).toBe(401);
    expect((await getItems(outsider.token, shoppingListId)).status).toBe(404);
    expect((await addItem(outsider.token, shoppingListId, { catalogItemKey: 'milk' })).status).toBe(404);
    const foreignPatch = await createJsonRequest(`${itemsPath(shoppingListId)}/${added.body.item.id}`, {
      method: 'PATCH',
      headers: bearer(outsider.token),
      body: JSON.stringify({ status: 'bought' }),
    });
    expect(foreignPatch.status).toBe(404);
    const unknown = await createJsonRequest<{ message: string }>(`${itemsPath(shoppingListId)}/${UNKNOWN_ID}`, {
      method: 'DELETE',
      headers: bearer(owner.token),
    });
    expect(unknown.status).toBe(404);
    expect(unknown.body.message).toBe('Item not found.');
  });
});
