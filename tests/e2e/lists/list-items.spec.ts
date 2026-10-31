// The List screen: search the default catalog and the list's custom items,
// add, mark bought, add back from "Last used", and swipe to remove.
import { test, expect } from '../fixtures/auth';
import { api, createShoppingListViaApi, registerNamedUser } from '../fixtures/lists';
import { ShoppingListDetailPage } from '../pages';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173';

test('list items: add from the catalog, buy, add back, custom item, swipe to remove', async ({
  pageForUser,
}) => {
  const owner = await registerNamedUser('Items');
  const list = await createShoppingListViaApi(owner, [], 'e2e-items');
  const page = await pageForUser(owner.email, owner.password);
  const detailPage = new ShoppingListDetailPage(page);

  await page.goto(`/lists/${list.id}`);
  await expect(page.getByRole('heading', { name: list.name, level: 1 })).toBeVisible();
  await expect(page.getByTestId('list-empty')).toBeVisible();

  await detailPage.addFromSearch('pine', 'Pineapple');
  await detailPage.addFromSearch('milk', 'Milk');
  await expect(detailPage.searchField()).toHaveValue('');
  // Sections in default order: Fruits & Vegetables before Milk & Cheese.
  await expect.poll(() => detailPage.tileNames(detailPage.toBuyList())).toEqual(['Pineapple', 'Milk']);

  // An item already on the list is shown as such, not offered again.
  await detailPage.search('pineap');
  await expect(detailPage.searchResult('Pineapple is already in the list')).toBeVisible();
  await detailPage.searchField().fill('');

  await detailPage.markBought('Milk');
  await expect(detailPage.lastUsedList().getByText('Milk')).toBeVisible();
  await expect.poll(() => detailPage.tileNames(detailPage.toBuyList())).toEqual(['Pineapple']);

  await detailPage.addBack('Milk');
  await expect.poll(() => detailPage.tileNames(detailPage.toBuyList())).toEqual(['Pineapple', 'Milk']);

  const customName = `Nonna's sauce ${Date.now() % 10000}`;
  await detailPage.addCustomItem(customName);
  await expect(detailPage.toBuyList().getByText(customName)).toBeVisible();
  await detailPage.markBought(customName);
  // The custom item is now searchable in this list.
  await detailPage.search('nonna');
  await expect(detailPage.searchResult(`Add ${customName}`)).toBeVisible();
  await detailPage.searchField().fill('');

  await detailPage.swipeRemove('Pineapple');
  await expect.poll(() => detailPage.tileNames(detailPage.toBuyList())).toEqual(['Milk']);

  // Everything survives a reload.
  await page.reload();
  await expect.poll(() => detailPage.tileNames(detailPage.toBuyList())).toEqual(['Milk']);
  await expect(detailPage.lastUsedList().getByText(customName)).toBeVisible();
});

test('list items: an Italian user searches the catalog in Italian', async ({ pageForUser }) => {
  const owner = await registerNamedUser('Articoli');
  const response = await fetch(`${baseURL}/api/auth/me`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${owner.token}` },
    body: JSON.stringify({ language: 'it' }),
  });
  expect(response.status).toBe(200);
  const list = await createShoppingListViaApi(owner, [], 'e2e-articoli');
  const page = await pageForUser(owner.email, owner.password);

  await page.goto(`/lists/${list.id}`);
  await page.getByRole('textbox', { name: 'Cerca o aggiungi un articolo' }).fill('fragol');
  await page.getByRole('list', { name: 'Articoli trovati' }).getByRole('button', { name: 'Aggiungi Fragole' }).click();

  await expect(
    page.getByRole('list', { name: 'Da comprare' }).getByRole('button', { name: 'Segna Fragole come comprato' }),
  ).toBeVisible();
});

test('list items: a long list keeps full-height tiles and scrolls', async ({ pageForUser }) => {
  const owner = await registerNamedUser('Scroll');
  const list = await createShoppingListViaApi(owner, [], 'e2e-scroll');
  const keys = ['apples', 'bananas', 'milk', 'bread', 'eggs', 'mozzarella', 'rice', 'coffee', 'tea', 'butter'];
  for (const catalogItemKey of keys) {
    await api(owner.token, 'POST', `/lists/${list.id}/items`, { catalogItemKey });
  }
  const page = await pageForUser(owner.email, owner.password);
  await page.setViewportSize({ width: 390, height: 640 });
  const detailPage = new ShoppingListDetailPage(page);

  await page.goto(`/lists/${list.id}`);
  const tiles = detailPage.toBuyList().getByTestId('list-item');
  await expect(tiles).toHaveCount(keys.length);

  // The tiles never shrink to fit the screen: the list scrolls instead.
  for (const tile of await tiles.all()) {
    expect((await tile.boundingBox())?.height).toBeGreaterThanOrEqual(72);
  }
  const last = tiles.last();
  await last.scrollIntoViewIfNeeded();
  await expect(last).toBeInViewport();
});
