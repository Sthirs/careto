import { createJsonRequest, createMultipartRequest, ensureBackendAvailable } from './helpers/api';
import { bearer, createSoloShoppingList, newUser, UNKNOWN_ID } from './helpers/lists';

type Dish = {
  id: string;
  name: string;
  imageUrl: string | null;
  pausedUntil: string | null;
  lastAddedAt: string | null;
  inList: boolean;
  ingredients: Array<{ catalogItemKey: string | null; customItem: { id: string; name: string } | null }>;
};
type Item = { id: string; status: 'to_buy' | 'bought'; source: string; catalogItemKey: string | null };

const dishesPath = (listId: string) => `/api/lists/${listId}/dishes`;

const send = <T>(token: string, path: string, method: string, body?: unknown) =>
  createJsonRequest<T & { message?: string }>(path, {
    method,
    headers: bearer(token),
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const createDish = (token: string, listId: string, name: string, keys: string[]) =>
  send<{ dish: Dish }>(token, dishesPath(listId), 'POST', {
    name,
    ingredients: keys.map((catalogItemKey) => ({ catalogItemKey })),
  });

const addToList = (token: string, listId: string, dishId: string) =>
  send<{ dish: Dish }>(token, `${dishesPath(listId)}/${dishId}/list`, 'POST');

const undo = (token: string, listId: string, dishId: string) =>
  send<{ dish: Dish }>(token, `${dishesPath(listId)}/${dishId}/list`, 'DELETE');

const items = async (token: string, listId: string) =>
  (await send<{ items: Item[] }>(token, `/api/lists/${listId}/items`, 'GET')).body.items;

const getDish = async (token: string, listId: string, dishId: string) =>
  (await send<{ dish: Dish }>(token, `${dishesPath(listId)}/${dishId}`, 'GET')).body.dish;

describe('dishes API', () => {
  beforeAll(async () => {
    await ensureBackendAvailable();
  });

  it('creates, reads, replaces and deletes a dish', async () => {
    const { shoppingListId, owner } = await createSoloShoppingList('dishes-crud');

    const created = await send<{ dish: Dish }>(owner.token, dishesPath(shoppingListId), 'POST', {
      name: ' Pasta  alla Norma ',
      ingredients: [{ catalogItemKey: 'eggplant' }, { customName: 'Ricotta salata' }],
    });
    expect(created.status).toBe(201);
    expect(created.body.dish).toMatchObject({ name: 'Pasta alla Norma', inList: false, lastAddedAt: null });
    expect(created.body.dish.ingredients[0].catalogItemKey).toBe('eggplant');
    expect(created.body.dish.ingredients[1].customItem?.name).toBe('Ricotta salata');

    const listed = await send<{ dishes: Dish[] }>(owner.token, dishesPath(shoppingListId), 'GET');
    expect(listed.body.dishes.map((dish) => dish.id)).toEqual([created.body.dish.id]);

    const replaced = await send<{ dish: Dish }>(owner.token, `${dishesPath(shoppingListId)}/${created.body.dish.id}`, 'PUT', {
      name: 'Norma',
      ingredients: [{ catalogItemKey: 'pasta' }],
    });
    expect(replaced.status).toBe(200);
    expect(replaced.body.dish.name).toBe('Norma');
    expect(replaced.body.dish.ingredients.map((i) => i.catalogItemKey)).toEqual(['pasta']);

    const deleted = await send(owner.token, `${dishesPath(shoppingListId)}/${created.body.dish.id}`, 'DELETE');
    expect(deleted.status).toBe(204);
    expect((await send(owner.token, `${dishesPath(shoppingListId)}/${created.body.dish.id}`, 'GET')).status).toBe(404);
  });

  it('rejects a dish without ingredients', async () => {
    const { shoppingListId, owner } = await createSoloShoppingList('dishes-empty');
    const response = await send(owner.token, dishesPath(shoppingListId), 'POST', { name: 'Air', ingredients: [] });
    expect(response.status).toBe(400);
  });

  it('hides dishes from non-members and 404s unknown dishes', async () => {
    const { shoppingListId, owner } = await createSoloShoppingList('dishes-private');
    const stranger = await newUser('dishes-stranger');
    expect((await send(stranger.token, dishesPath(shoppingListId), 'GET')).status).toBe(404);
    expect((await createDish(stranger.token, shoppingListId, 'Soup', ['onions'])).status).toBe(404);
    expect((await send(owner.token, `${dishesPath(shoppingListId)}/${UNKNOWN_ID}`, 'GET')).status).toBe(404);
  });

  it('is in the list until every ingredient is bought', async () => {
    const { shoppingListId, owner } = await createSoloShoppingList('dishes-buy');
    const { dish } = (await createDish(owner.token, shoppingListId, 'Lasagna', ['pasta', 'ground-meat'])).body;

    const added = await addToList(owner.token, shoppingListId, dish.id);
    expect(added.body.dish).toMatchObject({ inList: true, lastAddedAt: expect.any(String) });
    const onList = await items(owner.token, shoppingListId);
    expect(onList.map((item) => [item.catalogItemKey, item.source]).sort()).toEqual([
      ['ground-meat', 'dish'],
      ['pasta', 'dish'],
    ]);

    const buy = (item: Item) =>
      send(owner.token, `/api/lists/${shoppingListId}/items/${item.id}`, 'PATCH', { status: 'bought' });
    await buy(onList[0]);
    expect((await getDish(owner.token, shoppingListId, dish.id)).inList).toBe(true);
    await buy(onList[1]);
    expect((await getDish(owner.token, shoppingListId, dish.id)).inList).toBe(false);
  });

  it('never counts a dish in the list for an item added by hand', async () => {
    const { shoppingListId, owner } = await createSoloShoppingList('dishes-manual');
    const { dish } = (await createDish(owner.token, shoppingListId, 'Pasta', ['pasta'])).body;
    await send(owner.token, `/api/lists/${shoppingListId}/items`, 'POST', { catalogItemKey: 'pasta' });
    expect((await getDish(owner.token, shoppingListId, dish.id)).inList).toBe(false);
  });

  it('undo removes only what the dish alone put on the list', async () => {
    const { shoppingListId, owner } = await createSoloShoppingList('dishes-undo');
    await send(owner.token, `/api/lists/${shoppingListId}/items`, 'POST', { catalogItemKey: 'onions' });
    const lasagna = (await createDish(owner.token, shoppingListId, 'Lasagna', ['pasta', 'onions', 'mozzarella'])).body.dish;
    const pizza = (await createDish(owner.token, shoppingListId, 'Pizza', ['mozzarella'])).body.dish;

    const firstAdd = (await addToList(owner.token, shoppingListId, lasagna.id)).body.dish.lastAddedAt;
    await addToList(owner.token, shoppingListId, pizza.id);
    expect(firstAdd).not.toBeNull();

    const undone = await undo(owner.token, shoppingListId, lasagna.id);
    expect(undone.body.dish).toMatchObject({ inList: false, lastAddedAt: null });

    const keys = (await items(owner.token, shoppingListId)).map((item) => item.catalogItemKey).sort();
    expect(keys).toEqual(['mozzarella', 'onions']);
    expect((await getDish(owner.token, shoppingListId, pizza.id)).inList).toBe(true);
  });

  it('keeps an ingredient that a member also added by hand when the dish is taken off', async () => {
    const { shoppingListId, owner } = await createSoloShoppingList('dishes-claim');
    const { dish } = (await createDish(owner.token, shoppingListId, 'Salad', ['tomatoes'])).body;
    await addToList(owner.token, shoppingListId, dish.id);
    await send(owner.token, `/api/lists/${shoppingListId}/items`, 'POST', { catalogItemKey: 'tomatoes' });

    await undo(owner.token, shoppingListId, dish.id);

    const onList = await items(owner.token, shoppingListId);
    expect(onList.map((item) => [item.catalogItemKey, item.status, item.source])).toEqual([
      ['tomatoes', 'to_buy', 'user'],
    ]);
  });

  it('returns a bought hand item that only the dish put back to bought', async () => {
    const { shoppingListId, owner } = await createSoloShoppingList('dishes-reopen');
    const added = await send<{ item: Item }>(owner.token, `/api/lists/${shoppingListId}/items`, 'POST', {
      catalogItemKey: 'onions',
    });
    await send(owner.token, `/api/lists/${shoppingListId}/items/${added.body.item.id}`, 'PATCH', { status: 'bought' });
    const { dish } = (await createDish(owner.token, shoppingListId, 'Soup', ['onions'])).body;

    await addToList(owner.token, shoppingListId, dish.id);
    await undo(owner.token, shoppingListId, dish.id);

    const onList = await items(owner.token, shoppingListId);
    expect(onList.map((item) => [item.catalogItemKey, item.status])).toEqual([['onions', 'bought']]);
  });

  it('restores the real add date after a repeated add', async () => {
    const { shoppingListId, owner } = await createSoloShoppingList('dishes-twice');
    const { dish } = (await createDish(owner.token, shoppingListId, 'Pasta', ['pasta'])).body;

    const first = (await addToList(owner.token, shoppingListId, dish.id)).body.dish.lastAddedAt;
    const second = await addToList(owner.token, shoppingListId, dish.id);
    expect(second.status).toBe(200);
    expect(second.body.dish.lastAddedAt).toBe(first);

    const undone = await undo(owner.token, shoppingListId, dish.id);
    expect(undone.body.dish.lastAddedAt).toBeNull();
  });

  it('is in the list again after re-adding a dish whose items were bought', async () => {
    const { shoppingListId, owner } = await createSoloShoppingList('dishes-readd');
    const { dish } = (await createDish(owner.token, shoppingListId, 'Pesto', ['basil'])).body;
    await addToList(owner.token, shoppingListId, dish.id);
    const [item] = await items(owner.token, shoppingListId);
    await send(owner.token, `/api/lists/${shoppingListId}/items/${item.id}`, 'PATCH', { status: 'bought' });

    const again = await addToList(owner.token, shoppingListId, dish.id);

    expect(again.status).toBe(200);
    expect(again.body.dish.inList).toBe(true);
  });

  it('comes back in the list when a mistaken buy is undone', async () => {
    const { shoppingListId, owner } = await createSoloShoppingList('dishes-unbuy');
    const { dish } = (await createDish(owner.token, shoppingListId, 'Pasta', ['pasta'])).body;
    await addToList(owner.token, shoppingListId, dish.id);
    const [item] = await items(owner.token, shoppingListId);
    const patch = (status: Item['status']) =>
      send(owner.token, `/api/lists/${shoppingListId}/items/${item.id}`, 'PATCH', { status });

    await patch('bought');
    expect((await getDish(owner.token, shoppingListId, dish.id)).inList).toBe(false);
    await patch('to_buy');
    expect((await getDish(owner.token, shoppingListId, dish.id)).inList).toBe(true);
  });

  it('goes back to Suggested when its items are swiped away', async () => {
    const { shoppingListId, owner } = await createSoloShoppingList('dishes-swipe');
    const { dish } = (await createDish(owner.token, shoppingListId, 'Pasta', ['pasta'])).body;
    await addToList(owner.token, shoppingListId, dish.id);
    const [item] = await items(owner.token, shoppingListId);
    await send(owner.token, `/api/lists/${shoppingListId}/items/${item.id}`, 'DELETE');
    expect((await getDish(owner.token, shoppingListId, dish.id)).inList).toBe(false);
  });

  it('pauses and resumes', async () => {
    const { shoppingListId, owner } = await createSoloShoppingList('dishes-pause');
    const { dish } = (await createDish(owner.token, shoppingListId, 'Soup', ['onions'])).body;
    const path = `${dishesPath(shoppingListId)}/${dish.id}`;

    const paused = await send<{ dish: Dish }>(owner.token, path, 'PATCH', { pausedUntil: '2030-01-15' });
    expect(paused.body.dish.pausedUntil).toBe('2030-01-15');
    const resumed = await send<{ dish: Dish }>(owner.token, path, 'PATCH', { pausedUntil: null });
    expect(resumed.body.dish.pausedUntil).toBeNull();
    expect((await send(owner.token, path, 'PATCH', { pausedUntil: 'soon' })).status).toBe(400);
  });

  it('stores a dish photo as a webp data URL', async () => {
    const { shoppingListId, owner } = await createSoloShoppingList('dishes-image');
    const { dish } = (await createDish(owner.token, shoppingListId, 'Soup', ['onions'])).body;
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64',
    );
    const form = new FormData();
    form.append('image', new Blob([png], { type: 'image/png' }), 'dish.png');

    const response = await createMultipartRequest<{ dish: Dish }>(
      `${dishesPath(shoppingListId)}/${dish.id}/image`,
      form,
      owner.token,
    );
    expect(response.status).toBe(200);
    expect(response.body.dish.imageUrl).toMatch(/^data:image\/webp;base64,/);
  });
});
