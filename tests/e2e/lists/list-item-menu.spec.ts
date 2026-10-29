// The ⋮ menu of a list item (ADR-0026): move it to another store section,
// change its icon, and remove it from the list.
import { expect, test } from '../fixtures/auth';
import { addItemViaApi } from '../fixtures/dishes';
import { createShoppingListViaApi, registerNamedUser } from '../fixtures/lists';
import { ShoppingListDetailPage } from '../pages';

test('item menu: change section, change icon, remove from list', async ({ pageForUser }) => {
  const owner = await registerNamedUser('ItemMenu');
  const list = await createShoppingListViaApi(owner, [], 'e2e-item-menu');
  await addItemViaApi(owner, list.id, 'pineapple');
  await addItemViaApi(owner, list.id, 'milk');
  const page = await pageForUser(owner.email, owner.password);
  const detailPage = new ShoppingListDetailPage(page);

  await page.goto(`/lists/${list.id}`);
  await detailPage.addCustomItem('Kombucha');
  await expect.poll(() => detailPage.tileNames(detailPage.toBuyList())).toEqual(['Pineapple', 'Milk', 'Kombucha']);

  // A custom item starts in "Own items"; filing it under Fruits & Vegetables re-sorts it.
  await detailPage.openItemMenu('Kombucha');
  await expect(detailPage.itemMenu()).toContainText('Custom item');
  await expect(detailPage.itemMenu()).toContainText('Not sorted yet');
  await page.keyboard.press('Escape');
  await detailPage.changeSection('Kombucha', 'Fruits & Vegetables');
  await expect.poll(() => detailPage.tileNames(detailPage.toBuyList())).toEqual(['Kombucha', 'Pineapple', 'Milk']);

  const milkIcon = await detailPage.tileIconPath('Milk');
  await detailPage.changeIcon('Milk', 'coffee', 'Coffee');
  await expect.poll(() => detailPage.tileIconPath('Milk')).not.toBe(milkIcon);
  const coffeeIcon = await detailPage.tileIconPath('Milk');

  await detailPage.removeViaMenu('Pineapple');
  await expect.poll(() => detailPage.tileNames(detailPage.toBuyList())).toEqual(['Kombucha', 'Milk']);

  await page.reload();
  await expect.poll(() => detailPage.tileNames(detailPage.toBuyList())).toEqual(['Kombucha', 'Milk']);
  expect(await detailPage.tileIconPath('Milk')).toBe(coffeeIcon);
});
