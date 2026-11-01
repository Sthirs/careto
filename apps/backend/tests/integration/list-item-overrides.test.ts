import { createJsonRequest, ensureBackendAvailable } from './helpers/api';
import { bearer, createSoloShoppingList, newUser } from './helpers/lists';

type Item = {
  id: string;
  sectionKey: string;
  defaultSectionKey: string;
  iconKey: string | null;
};
type ItemsView = { sectionOrder: string[]; items: Item[] };
type OrderView = { sectionKeys: string[] };

const itemsPath = (shoppingListId: string) => `/api/lists/${shoppingListId}/items`;
const orderPath = (shoppingListId: string) => `/api/lists/${shoppingListId}/section-order`;

const patchItem = (token: string, shoppingListId: string, itemId: string, body: unknown) =>
  createJsonRequest<{ item: Item }>(`${itemsPath(shoppingListId)}/${itemId}`, {
    method: 'PATCH',
    headers: bearer(token),
    body: JSON.stringify(body),
  });

describe('list item overrides and section order API', () => {
  beforeAll(async () => {
    await ensureBackendAvailable();
  });

  it('changes and clears the icon and section of an item', async () => {
    const { shoppingListId, owner } = await createSoloShoppingList('overrides');
    const added = await createJsonRequest<{ item: Item }>(itemsPath(shoppingListId), {
      method: 'POST',
      headers: bearer(owner.token),
      body: JSON.stringify({ customName: 'Kombucha' }),
    });
    const itemId = added.body.item.id;

    const iconed = await patchItem(owner.token, shoppingListId, itemId, { iconKey: 'coffee' });
    expect(iconed.status).toBe(200);
    expect(iconed.body.item.iconKey).toBe('coffee');

    const moved = await patchItem(owner.token, shoppingListId, itemId, { sectionKey: 'beverages' });
    expect(moved.body.item).toMatchObject({
      sectionKey: 'beverages',
      defaultSectionKey: 'own-items',
      iconKey: 'coffee',
    });

    const listed = await createJsonRequest<ItemsView>(itemsPath(shoppingListId), {
      headers: bearer(owner.token),
    });
    expect(listed.body.items[0]).toMatchObject({ sectionKey: 'beverages', iconKey: 'coffee' });

    const cleared = await patchItem(owner.token, shoppingListId, itemId, { sectionKey: null });
    expect(cleared.body.item.sectionKey).toBe('own-items');

    expect((await patchItem(owner.token, shoppingListId, itemId, { sectionKey: 'own-items' })).status).toBe(400);
  });

  it('shows the chosen icon and section on dish ingredients and keeps them after removal', async () => {
    const { shoppingListId, owner } = await createSoloShoppingList('overrides-shared');
    const added = await createJsonRequest<{ item: Item & { customItem: { id: string } } }>(
      itemsPath(shoppingListId),
      { method: 'POST', headers: bearer(owner.token), body: JSON.stringify({ customName: 'Kombucha' }) },
    );
    const { id: itemId, customItem } = added.body.item;
    await patchItem(owner.token, shoppingListId, itemId, { iconKey: 'coffee' });
    await patchItem(owner.token, shoppingListId, itemId, { sectionKey: 'beverages' });

    const dish = await createJsonRequest<{ dish: { ingredients: Array<Record<string, unknown>> } }>(
      `/api/lists/${shoppingListId}/dishes`,
      {
        method: 'POST',
        headers: bearer(owner.token),
        body: JSON.stringify({ name: 'Brunch', ingredients: [{ customItemId: customItem.id }] }),
      },
    );
    expect(dish.body.dish.ingredients[0]).toMatchObject({
      iconKey: 'coffee',
      sectionKey: 'beverages',
      defaultSectionKey: 'own-items',
    });

    const removed = await createJsonRequest(`${itemsPath(shoppingListId)}/${itemId}`, {
      method: 'DELETE',
      headers: bearer(owner.token),
    });
    expect(removed.status).toBeLessThan(300);

    const addedAgain = await createJsonRequest<{ item: Item }>(itemsPath(shoppingListId), {
      method: 'POST',
      headers: bearer(owner.token),
      body: JSON.stringify({ customItemId: customItem.id }),
    });
    expect(addedAgain.body.item).toMatchObject({ iconKey: 'coffee', sectionKey: 'beverages' });
  });

  it('saves, applies and resets the section order', async () => {
    const { shoppingListId, owner } = await createSoloShoppingList('section-order');
    const initial = await createJsonRequest<OrderView>(orderPath(shoppingListId), {
      headers: bearer(owner.token),
    });
    expect(initial.status).toBe(200);
    expect(initial.body.sectionKeys).not.toContain('own-items');

    const reversed = [...initial.body.sectionKeys].reverse();
    const saved = await createJsonRequest<OrderView>(orderPath(shoppingListId), {
      method: 'PUT',
      headers: bearer(owner.token),
      body: JSON.stringify({ sectionKeys: reversed }),
    });
    expect(saved.status).toBe(200);
    expect(saved.body.sectionKeys).toEqual(reversed);

    const items = await createJsonRequest<ItemsView>(itemsPath(shoppingListId), {
      headers: bearer(owner.token),
    });
    expect(items.body.sectionOrder).toEqual([...reversed, 'own-items']);

    const reset = await createJsonRequest<OrderView>(orderPath(shoppingListId), {
      method: 'DELETE',
      headers: bearer(owner.token),
    });
    expect(reset.body.sectionKeys).toEqual(initial.body.sectionKeys);
  });

  it('hides the order of a list from non-members', async () => {
    const { shoppingListId } = await createSoloShoppingList('section-order-private');
    const stranger = await newUser('section-order-stranger');
    const response = await createJsonRequest(orderPath(shoppingListId), {
      headers: bearer(stranger.token),
    });
    expect(response.status).toBe(404);
  });
});
