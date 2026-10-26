// Deleting a dish asks first; its items stay on the shopping list.
import { test, expect } from '../fixtures/auth';
import { addDishToListViaApi, createDishViaApi } from '../fixtures/dishes';
import { createShoppingListViaApi, registerNamedUser } from '../fixtures/lists';
import { DishesPage, DishFormPage, ShoppingListDetailPage } from '../pages';

test('delete dish: Keep it, then Delete; its items stay on the list', async ({ pageForUser }) => {
  const owner = await registerNamedUser('Delete');
  const list = await createShoppingListViaApi(owner, [], 'e2e-dish-delete');
  const dish = await createDishViaApi(owner, list.id, { name: 'Lasagna', ingredients: [{ catalogItemKey: 'pasta' }] });
  await addDishToListViaApi(owner, list.id, dish.id);
  const page = await pageForUser(owner.email, owner.password);
  const dishesPage = new DishesPage(page);
  const form = new DishFormPage(page);
  const listPage = new ShoppingListDetailPage(page);

  await page.goto('/lists');
  await dishesPage.goto(list.id);
  await dishesPage.openEdit('Lasagna');

  await form.openDelete();
  await expect(form.deleteSheet()).toContainText('Delete Lasagna?');
  await form.keep();
  await expect(form.nameField()).toHaveValue('Lasagna');

  await form.openDelete();
  await form.confirmDelete();
  await expect(dishesPage.card('Lasagna')).toHaveCount(0);
  await expect(dishesPage.suggestedSection()).toContainText('No dishes to suggest.');

  // One Back press from Dishes reaches the page before it: neither the deleted
  // dish nor its sheet left an entry behind.
  await page.goBack();
  await expect(page).toHaveURL(/\/lists$/);

  await page.goto(`/lists/${list.id}`);
  await expect.poll(() => listPage.tileNames(listPage.toBuyList())).toEqual(['Pasta']);
});

test('delete dish: browser Back closes the delete sheet', async ({ pageForUser }) => {
  const owner = await registerNamedUser('DeleteBack');
  const list = await createShoppingListViaApi(owner, [], 'e2e-dish-delete-back');
  await createDishViaApi(owner, list.id, { name: 'Soup', ingredients: [{ catalogItemKey: 'onions' }] });
  const page = await pageForUser(owner.email, owner.password);
  const dishesPage = new DishesPage(page);
  const form = new DishFormPage(page);

  await dishesPage.goto(list.id);
  await dishesPage.openEdit('Soup');
  await form.openDelete();
  await page.goBack();
  await expect(form.deleteSheet()).toBeHidden();
  await expect(form.nameField()).toHaveValue('Soup');
});
