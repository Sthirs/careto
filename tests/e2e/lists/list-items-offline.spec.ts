// ADR-0030: with the list open, the connection drops; the member keeps adding,
// buying and removing items, even across a reload, and every change reaches
// the server once the connection is back.
import { test, expect } from '../fixtures/auth';
import { api, createShoppingListViaApi, registerNamedUser } from '../fixtures/lists';
import { ShoppingListDetailPage } from '../pages';

type ServerItem = {
  status: 'to_buy' | 'bought';
  catalogItemKey: string | null;
  customItem: { name: string } | null;
};

test('list items offline: add, buy and remove without a connection, then sync', async ({ pageForUser }) => {
  const owner = await registerNamedUser('Offline');
  const list = await createShoppingListViaApi(owner, [], 'e2e-offline');
  await api(owner.token, 'POST', `/lists/${list.id}/items`, { catalogItemKey: 'bread' });
  const page = await pageForUser(owner.email, owner.password);
  const detailPage = new ShoppingListDetailPage(page);

  await page.goto(`/lists/${list.id}`);
  await expect.poll(() => detailPage.tileNames(detailPage.toBuyList())).toEqual(['Bread']);
  // The service worker must control the page for an offline reload to load the app.
  await page.waitForFunction(() => navigator.serviceWorker?.controller !== null);
  await expect(detailPage.syncStatus()).toBeHidden();

  await page.context().setOffline(true);
  await expect(detailPage.syncStatus()).toContainText("You're offline");

  const customName = `Offline sauce ${Date.now() % 10000}`;
  await detailPage.addFromSearch('milk', 'Milk');
  await detailPage.addCustomItem(customName);
  await detailPage.markBought(customName, { offline: true });
  await detailPage.swipeRemove('Bread', { offline: true });

  await expect.poll(() => detailPage.tileNames(detailPage.toBuyList())).toEqual(['Milk']);
  await expect(detailPage.lastUsedList().getByText(customName)).toBeVisible();
  await expect(page.getByTestId('sync-pending')).toHaveText('4 changes waiting to sync');

  // The app is reloaded while still offline: the list and the waiting changes survive.
  await page.reload();
  await expect.poll(() => detailPage.tileNames(detailPage.toBuyList())).toEqual(['Milk']);
  await expect(detailPage.lastUsedList().getByText(customName)).toBeVisible();
  await expect(page.getByTestId('sync-pending')).toHaveText('4 changes waiting to sync');

  await page.context().setOffline(false);

  const serverState = async () => {
    const { items } = await api<{ items: ServerItem[] }>(owner.token, 'GET', `/lists/${list.id}/items`);
    return items
      .map((item) => `${item.catalogItemKey ?? item.customItem?.name}:${item.status}`)
      .sort();
  };
  await expect
    .poll(serverState, { timeout: 30_000 })
    .toEqual([`${customName}:bought`, 'milk:to_buy'].sort());
  await expect(detailPage.syncStatus()).toBeHidden();
  // The screen still matches the server after the sync.
  await expect.poll(() => detailPage.tileNames(detailPage.toBuyList())).toEqual(['Milk']);
});

// ADR-0031: a change made offline loses to a later change of the same item
// by another member, and the list says the older change was skipped.
test('list items offline: a later change by another member wins over an older offline change', async ({
  pageForUser,
}) => {
  const owner = await registerNamedUser('Anna');
  const member = await registerNamedUser('Ben');
  const list = await createShoppingListViaApi(owner, [member], 'e2e-offline-latest');
  const { item: bread } = await api<{ item: { id: string } }>(owner.token, 'POST', `/lists/${list.id}/items`, {
    catalogItemKey: 'bread',
  });
  const page = await pageForUser(owner.email, owner.password);
  const detailPage = new ShoppingListDetailPage(page);

  await page.goto(`/lists/${list.id}`);
  await expect.poll(() => detailPage.tileNames(detailPage.toBuyList())).toEqual(['Bread']);

  // Anna removes the bread while offline...
  await page.context().setOffline(true);
  await expect(detailPage.syncStatus()).toContainText("You're offline");
  await detailPage.swipeRemove('Bread', { offline: true });
  await expect(page.getByTestId('sync-pending')).toHaveText('1 change waiting to sync');

  // ...and Ben buys it afterwards, online.
  await api(member.token, 'PATCH', `/lists/${list.id}/items/${bread.id}`, { status: 'bought' });

  await page.context().setOffline(false);

  await expect(page.getByRole('alert')).toHaveText(
    'Someone changed an item after you, so your older change was skipped.',
    { timeout: 30_000 },
  );
  await expect(detailPage.lastUsedList().getByText('Bread')).toBeVisible();
  const { items } = await api<{ items: ServerItem[] }>(owner.token, 'GET', `/lists/${list.id}/items`);
  expect(items.map((item) => `${item.catalogItemKey}:${item.status}`)).toEqual(['bread:bought']);
});

// ADR-0031: offline is meant for minutes or hours. A change still waiting an
// hour after the tap is discarded, and the list reloads and says so.
test('list items offline: a change waiting more than an hour is discarded', async ({ pageForUser }) => {
  const owner = await registerNamedUser('Late');
  const list = await createShoppingListViaApi(owner, [], 'e2e-offline-expired');
  await api(owner.token, 'POST', `/lists/${list.id}/items`, { catalogItemKey: 'bread' });
  const page = await pageForUser(owner.email, owner.password);
  const detailPage = new ShoppingListDetailPage(page);

  await page.goto(`/lists/${list.id}`);
  await expect.poll(() => detailPage.tileNames(detailPage.toBuyList())).toEqual(['Bread']);

  await page.context().setOffline(true);
  await expect(detailPage.syncStatus()).toContainText("You're offline");
  await detailPage.swipeRemove('Bread', { offline: true });
  await expect(page.getByTestId('sync-pending')).toHaveText('1 change waiting to sync');

  // An hour and a minute later, the connection is back.
  await page.clock.setFixedTime(Date.now() + 61 * 60_000);
  await page.context().setOffline(false);

  await expect(page.getByRole('alert')).toHaveText(
    'Changes made offline more than an hour ago were discarded, so the list was reloaded.',
    { timeout: 45_000 },
  );
  await expect.poll(() => detailPage.tileNames(detailPage.toBuyList())).toEqual(['Bread']);
  await expect(detailPage.syncStatus()).toBeHidden();
  const { items } = await api<{ items: ServerItem[] }>(owner.token, 'GET', `/lists/${list.id}/items`);
  expect(items.map((item) => `${item.catalogItemKey}:${item.status}`)).toEqual(['bread:to_buy']);
});
