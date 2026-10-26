// Dishes belong to the list: every member sees the same dishes and status.
import { test, expect } from '../fixtures/auth';
import { addDishToListViaApi, createDishViaApi } from '../fixtures/dishes';
import { createShoppingListViaApi, registerNamedUser } from '../fixtures/lists';
import { DishesPage } from '../pages';

test('dishes: another member sees a dish in the list', async ({ pageForUser }) => {
  const owner = await registerNamedUser('Owner');
  const member = await registerNamedUser('Member');
  const list = await createShoppingListViaApi(owner, [member], 'e2e-dish-members');
  const dish = await createDishViaApi(owner, list.id, { name: 'Lasagna', ingredients: [{ catalogItemKey: 'pasta' }] });
  await addDishToListViaApi(owner, list.id, dish.id);

  const page = await pageForUser(member.email, member.password);
  const dishesPage = new DishesPage(page);
  await dishesPage.goto(list.id);
  await expect.poll(() => dishesPage.names(dishesPage.inListSection())).toEqual(['Lasagna']);
});

test('dishes: a non-member cannot load the dishes of a list', async ({ pageForUser }) => {
  const owner = await registerNamedUser('Private');
  const stranger = await registerNamedUser('Stranger');
  const list = await createShoppingListViaApi(owner, [], 'e2e-dish-private');
  await createDishViaApi(owner, list.id, { name: 'Secret', ingredients: [{ catalogItemKey: 'pasta' }] });

  const page = await pageForUser(stranger.email, stranger.password);
  await page.goto(`/lists/${list.id}/dishes`);
  await expect(page.getByRole('alert')).toHaveText('We could not load the dishes.');
  await expect(page.getByTestId('dish-card')).toHaveCount(0);
});
