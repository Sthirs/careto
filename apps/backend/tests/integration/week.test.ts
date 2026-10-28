import { createJsonRequest, ensureBackendAvailable } from './helpers/api';
import { bearer, createSoloShoppingList, newUser } from './helpers/lists';

type Slot = { weekday: number; meal: 'lunch' | 'dinner'; dishId: string };
type Item = { id: string; status: 'to_buy' | 'bought'; source: string; catalogItemKey: string | null };

const weekPath = (listId: string) => `/api/lists/${listId}/week`;

const send = <T>(token: string, path: string, method: string, body?: unknown) =>
  createJsonRequest<T & { message?: string }>(path, {
    method,
    headers: bearer(token),
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const createDish = async (token: string, listId: string, name: string, keys: string[]) =>
  (
    await send<{ dish: { id: string } }>(token, `/api/lists/${listId}/dishes`, 'POST', {
      name,
      ingredients: keys.map((catalogItemKey) => ({ catalogItemKey })),
    })
  ).body.dish.id;

const setSlot = (token: string, listId: string, slot: Omit<Slot, 'dishId'> & { dishId: string | null }) =>
  send<{ slots: Slot[] }>(token, `${weekPath(listId)}/slots`, 'PUT', slot);

const plan = async (token: string, listId: string) =>
  (await send<{ slots: Slot[] }>(token, weekPath(listId), 'GET')).body.slots;

describe('week plan API', () => {
  beforeAll(async () => {
    await ensureBackendAvailable();
  });

  it('assigns, changes and empties slots', async () => {
    const { shoppingListId, owner } = await createSoloShoppingList('week-slots');
    const pasta = await createDish(owner.token, shoppingListId, 'Pasta', ['pasta']);
    const soup = await createDish(owner.token, shoppingListId, 'Soup', ['carrots']);

    expect(await plan(owner.token, shoppingListId)).toEqual([]);

    await setSlot(owner.token, shoppingListId, { weekday: 1, meal: 'dinner', dishId: pasta });
    const changed = await setSlot(owner.token, shoppingListId, { weekday: 1, meal: 'dinner', dishId: soup });
    expect(changed.status).toBe(200);
    expect(changed.body.slots).toEqual([{ weekday: 1, meal: 'dinner', dishId: soup }]);

    await setSlot(owner.token, shoppingListId, { weekday: 1, meal: 'dinner', dishId: null });
    expect(await plan(owner.token, shoppingListId)).toEqual([]);
  });

  it('replaces the whole plan, as a new plan and its undo do', async () => {
    const { shoppingListId, owner } = await createSoloShoppingList('week-replace');
    const pasta = await createDish(owner.token, shoppingListId, 'Pasta', ['pasta']);
    const slots: Slot[] = [
      { weekday: 1, meal: 'lunch', dishId: pasta },
      { weekday: 5, meal: 'dinner', dishId: pasta },
    ];

    expect((await send(owner.token, weekPath(shoppingListId), 'PUT', { slots })).status).toBe(200);
    expect(await plan(owner.token, shoppingListId)).toEqual(slots);

    await send(owner.token, weekPath(shoppingListId), 'PUT', { slots: [] });
    expect(await plan(owner.token, shoppingListId)).toEqual([]);
  });

  it('adds the ingredients of every planned dish as dish items, and keeps the plan', async () => {
    const { shoppingListId, owner } = await createSoloShoppingList('week-add');
    const pasta = await createDish(owner.token, shoppingListId, 'Pasta', ['pasta', 'tomatoes']);
    const salad = await createDish(owner.token, shoppingListId, 'Salad', ['tomatoes', 'lettuce']);
    await setSlot(owner.token, shoppingListId, { weekday: 1, meal: 'lunch', dishId: pasta });
    await setSlot(owner.token, shoppingListId, { weekday: 2, meal: 'lunch', dishId: salad });
    await setSlot(owner.token, shoppingListId, { weekday: 3, meal: 'dinner', dishId: pasta });

    const added = await send(owner.token, `${weekPath(shoppingListId)}/list`, 'POST');
    expect(added.status).toBe(204);

    const items = (await send<{ items: Item[] }>(owner.token, `/api/lists/${shoppingListId}/items`, 'GET')).body.items;
    expect(items.map((item) => item.catalogItemKey).sort()).toEqual(['lettuce', 'pasta', 'tomatoes']);
    expect(items.every((item) => item.source === 'dish' && item.status === 'to_buy')).toBe(true);
    expect(await plan(owner.token, shoppingListId)).toHaveLength(3);
  });

  it('empties the slots of a deleted dish', async () => {
    const { shoppingListId, owner } = await createSoloShoppingList('week-delete');
    const pasta = await createDish(owner.token, shoppingListId, 'Pasta', ['pasta']);
    await setSlot(owner.token, shoppingListId, { weekday: 4, meal: 'lunch', dishId: pasta });

    await send(owner.token, `/api/lists/${shoppingListId}/dishes/${pasta}`, 'DELETE');
    expect(await plan(owner.token, shoppingListId)).toEqual([]);
  });

  it('rejects a dish of another list and non-members', async () => {
    const { shoppingListId, owner } = await createSoloShoppingList('week-guard');
    const other = await createSoloShoppingList('week-guard-other');
    const foreign = await createDish(other.owner.token, other.shoppingListId, 'Elsewhere', ['pasta']);

    const wrongDish = await setSlot(owner.token, shoppingListId, { weekday: 1, meal: 'lunch', dishId: foreign });
    expect(wrongDish.status).toBe(404);

    const stranger = await newUser('week-stranger');
    expect((await send(stranger.token, weekPath(shoppingListId), 'GET')).status).toBe(404);
    expect((await send(stranger.token, `${weekPath(shoppingListId)}/list`, 'POST')).status).toBe(404);
  });

  it('validates slot bodies', async () => {
    const { shoppingListId, owner } = await createSoloShoppingList('week-bodies');
    const bad = await send(owner.token, `${weekPath(shoppingListId)}/slots`, 'PUT', {
      weekday: 9,
      meal: 'lunch',
      dishId: null,
    });
    expect(bad.status).toBe(400);
  });
});
