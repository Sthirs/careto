// An icon chosen for an item on the list is the item's in that list
// (ADR-0029): the dish form shows it in search and among the ingredients,
// and it stays after the item leaves the list.
import { expect, test } from '../fixtures/auth';
import { createShoppingListViaApi, registerNamedUser } from '../fixtures/lists';
import { DishesPage, DishFormPage, ShoppingListDetailPage } from '../pages';

test('dish ingredients show the icon chosen on the list', async ({ pageForUser }) => {
  const owner = await registerNamedUser('Overrides');
  const list = await createShoppingListViaApi(owner, [], 'e2e-dish-overrides');
  const page = await pageForUser(owner.email, owner.password);
  const detailPage = new ShoppingListDetailPage(page);
  const dishesPage = new DishesPage(page);
  const form = new DishFormPage(page);

  await page.goto(`/lists/${list.id}`);
  await detailPage.addCustomItem('Kombucha');
  const tagIcon = await detailPage.tileIconPath('Kombucha');
  await detailPage.changeIcon('Kombucha', 'coffee', 'Coffee');
  await expect.poll(() => detailPage.tileIconPath('Kombucha')).not.toBe(tagIcon);
  const coffeeIcon = await detailPage.tileIconPath('Kombucha');

  // Removed from the list, the item keeps its icon.
  await detailPage.removeViaMenu('Kombucha');

  await dishesPage.goto(list.id);
  await dishesPage.newDish();
  await form.fillName('Brunch');
  await form.searchField().fill('Kombu');
  expect(await form.searchResultIconPath('Add Kombucha')).toBe(coffeeIcon);
  await form.searchResult('Add Kombucha').click();
  expect(await form.ingredientIconPath('Kombucha')).toBe(coffeeIcon);
  await form.save();

  await dishesPage.openEdit('Brunch');
  await expect.poll(() => form.ingredientNames()).toEqual(['Kombucha']);
  expect(await form.ingredientIconPath('Kombucha')).toBe(coffeeIcon);
});
