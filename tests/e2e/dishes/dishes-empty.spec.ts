// The Dishes screen on a list with no dishes: both sections are always shown,
// each with its empty text, and the navigation around it.
import { test, expect } from '../fixtures/auth';
import { createShoppingListViaApi, registerNamedUser } from '../fixtures/lists';
import { DishesPage } from '../pages';

test('dishes: empty sections, New dish, and back to My lists', async ({ pageForUser }) => {
  const owner = await registerNamedUser('Empty');
  const list = await createShoppingListViaApi(owner, [], 'e2e-dishes-empty');
  const page = await pageForUser(owner.email, owner.password);
  const dishesPage = new DishesPage(page);

  await dishesPage.goto(list.id);
  await expect(dishesPage.inListSection().getByRole('heading', { name: 'In the list' })).toBeVisible();
  await expect(dishesPage.inListSection()).toContainText('No dishes in the list yet.');
  await expect(dishesPage.suggestedSection().getByRole('heading', { name: 'Suggested' })).toBeVisible();
  await expect(dishesPage.suggestedSection()).toContainText('No dishes to suggest.');
  await expect(dishesPage.pausedSection()).toHaveCount(0);

  await dishesPage.newDish();
  await expect(page.getByRole('heading', { name: 'New dish', level: 1 })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/lists/${list.id}/dishes$`));

  await dishesPage.back();
  await expect(page.getByRole('heading', { name: 'My lists', level: 1 })).toBeVisible();
});

test('dishes: browser Back from Dishes goes to My lists', async ({ pageForUser }) => {
  const owner = await registerNamedUser('EmptyBack');
  const list = await createShoppingListViaApi(owner, [], 'e2e-dishes-back');
  const page = await pageForUser(owner.email, owner.password);

  await page.goto('/lists');
  await page.goto(`/lists/${list.id}/dishes`);
  await page.goBack();
  await expect(page).toHaveURL(/\/lists$/);
});
