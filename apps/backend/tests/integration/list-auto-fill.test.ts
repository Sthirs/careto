/**
 * ADR-0027: the seeder rebuilds the demo user's "Dispensa" list on every
 * startup with a back-dated purchase history, and the auto-fill run that
 * follows the seed puts its due products back on the list. These tests only
 * read the list, so they hold on every run after a deploy (the Playwright
 * spec reads the same list).
 */
import { createJsonRequest, ensureBackendAvailable } from './helpers/api';
import { bearer } from './helpers/lists';

type Item = { catalogItemKey: string | null; status: string; source: string };

const SEED_LIST_NAME = 'Dispensa';

describe('auto-fill of the seeded list', () => {
  let token: string;
  let items: Item[];

  beforeAll(async () => {
    await ensureBackendAvailable();
    const login = await createJsonRequest<{ token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'demo@careto.local', password: 'password123' }),
    });
    expect(login.status).toBe(200);
    token = login.body.token;

    const lists = await createJsonRequest<{ shoppingLists: { id: string; name: string }[] }>(
      '/api/lists',
      { headers: bearer(token) },
    );
    const seeded = lists.body.shoppingLists.find((list) => list.name === SEED_LIST_NAME);
    expect(seeded, 'the seeded auto-fill list exists').toBeDefined();

    const response = await createJsonRequest<{ items: Item[] }>(`/api/lists/${seeded?.id}/items`, {
      headers: bearer(token),
    });
    expect(response.status).toBe(200);
    items = response.body.items;
  });

  const itemOf = (key: string) => items.find((item) => item.catalogItemKey === key);

  it('puts due products bought by hand back to buy as recurring', () => {
    expect(itemOf('milk')).toMatchObject({ status: 'to_buy', source: 'recurring' });
    expect(itemOf('bread')).toMatchObject({ status: 'to_buy', source: 'recurring' });
  });

  it('never fills a product bought only for dishes', () => {
    expect(itemOf('mozzarella')).toMatchObject({ status: 'bought', source: 'dish' });
  });
});
