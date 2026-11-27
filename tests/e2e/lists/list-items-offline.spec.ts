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
