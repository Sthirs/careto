// The Dish screen: opened from a card, edits name and ingredients, and photo.
import { test, expect } from '../fixtures/auth';
import { createDishViaApi } from '../fixtures/dishes';
import { createShoppingListViaApi, registerNamedUser } from '../fixtures/lists';
import { DishesPage, DishFormPage } from '../pages';

test('edit dish: rename, change ingredients, save', async ({ pageForUser }) => {
  const owner = await registerNamedUser('Edit');
  const list = await createShoppingListViaApi(owner, [], 'e2e-dish-edit');
  await createDishViaApi(owner, list.id, {
    name: 'Lasagna',
    ingredients: [{ catalogItemKey: 'pasta' }, { catalogItemKey: 'ground-meat' }],
  });
  const page = await pageForUser(owner.email, owner.password);
  const dishesPage = new DishesPage(page);
  const form = new DishFormPage(page);

  await dishesPage.goto(list.id);
  await dishesPage.openEdit('Lasagna');
  await expect(page.getByRole('heading', { name: 'Dish', level: 1 })).toBeVisible();
  await expect(form.nameField()).toHaveValue('Lasagna');
  await expect.poll(() => form.ingredientNames()).toEqual(['Pasta', 'Ground meat']);

  await form.fillName('Lasagna verde');
  await form.removeIngredient('Ground meat');
  await form.addIngredient('mozz', 'Mozzarella');
  await form.save();
  await expect.poll(() => dishesPage.names(dishesPage.suggestedSection())).toEqual(['Lasagna verde']);

  await dishesPage.openEdit('Lasagna verde');
  await expect.poll(() => form.ingredientNames()).toEqual(['Pasta', 'Mozzarella']);
});

test('edit dish: the card photo opens it, the back arrow does not save', async ({ pageForUser }) => {
  const owner = await registerNamedUser('EditBack');
  const list = await createShoppingListViaApi(owner, [], 'e2e-dish-edit-back');
  await createDishViaApi(owner, list.id, { name: 'Soup', ingredients: [{ catalogItemKey: 'onions' }] });
  const page = await pageForUser(owner.email, owner.password);
  const dishesPage = new DishesPage(page);
  const form = new DishFormPage(page);

  await dishesPage.goto(list.id);
  await dishesPage.card('Soup').locator('a').first().click();
  await page.waitForURL(/\/dishes\/[0-9a-f-]{36}$/);
  await form.fillName('Not saved');
  await form.back();

  await expect.poll(() => dishesPage.names(dishesPage.suggestedSection())).toEqual(['Soup']);
});

test('edit dish: a new photo shows on the card', async ({ pageForUser }) => {
  const owner = await registerNamedUser('EditPhoto');
  const list = await createShoppingListViaApi(owner, [], 'e2e-dish-edit-photo');
  await createDishViaApi(owner, list.id, { name: 'Soup', ingredients: [{ catalogItemKey: 'onions' }] });
  const page = await pageForUser(owner.email, owner.password);
  const dishesPage = new DishesPage(page);
  const form = new DishFormPage(page);

  await dishesPage.goto(list.id);
  await expect(dishesPage.card('Soup').locator('img')).toHaveCount(0);
  await dishesPage.openEdit('Soup');
  await form.uploadPhoto();
  await expect(page.getByTestId('dish-photo').locator('img')).toHaveAttribute('src', /^data:image\/webp;base64,/);
  await form.back();

  await expect(dishesPage.card('Soup').locator('img')).toHaveAttribute('src', /^data:image\/webp;base64,/);
});
