// The expanded default catalog: items added from the supermarket catalog are
// found by search and sorted under their (new) store sections.
import { expect, test } from '../fixtures/auth';
import { createShoppingListViaApi, registerNamedUser } from '../fixtures/lists';
import { ShoppingListDetailPage } from '../pages';

test('catalog: new items are searchable and sorted under the new sections', async ({ pageForUser }) => {
  const owner = await registerNamedUser('Catalog');
  const list = await createShoppingListViaApi(owner, [], 'e2e-catalog');
  const page = await pageForUser(owner.email, owner.password);
  const detailPage = new ShoppingListDetailPage(page);

  await page.goto(`/lists/${list.id}`);
  await detailPage.addFromSearch('fusi', 'Fusilli');
  await detailPage.addFromSearch('speck', 'Speck');
  await detailPage.addFromSearch('pine', 'Pineapple');

  // Default order: Fruits & Vegetables, then Deli & Cold Cuts, then Grain Products.
  await expect.poll(() => detailPage.tileNames(detailPage.toBuyList())).toEqual(['Pineapple', 'Speck', 'Fusilli']);

  await detailPage.openItemMenu('Speck');
  await expect(detailPage.itemMenu()).toContainText('Deli & Cold Cuts');
});
