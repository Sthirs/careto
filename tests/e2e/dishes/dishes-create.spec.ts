// The New dish screen: name, catalog and custom ingredients, photo, and the
// ways out (Save, Cancel, back arrow, browser Back).
import { test, expect } from '../fixtures/auth';
import { createShoppingListViaApi, registerNamedUser } from '../fixtures/lists';
import { DishesPage, DishFormPage } from '../pages';

test('new dish: create with a catalog and a custom ingredient', async ({ pageForUser }) => {
  const owner = await registerNamedUser('Create');
  const list = await createShoppingListViaApi(owner, [], 'e2e-dish-create');
  const page = await pageForUser(owner.email, owner.password);
  const dishesPage = new DishesPage(page);
  const form = new DishFormPage(page);

  await dishesPage.goto(list.id);
  await dishesPage.newDish();
  await expect(page.getByText('No ingredients yet.')).toBeVisible();
  await expect(form.saveButton()).toBeDisabled();

  // A name alone, or ingredients alone, cannot be saved.
  await form.fillName('Pasta alla Norma');
  await expect(form.saveButton()).toBeDisabled();
  await form.addIngredient('eggpl', 'Eggplant');
  await expect(form.saveButton()).toBeEnabled();
  await form.fillName('');
  await expect(form.saveButton()).toBeDisabled();
  await form.fillName('Pasta alla Norma');

  // Removing the last ingredient disables Save again.
  await form.removeIngredient('Eggplant');
  await expect(page.getByText('No ingredients yet.')).toBeVisible();
  await expect(form.saveButton()).toBeDisabled();

  await form.addIngredient('eggpl', 'Eggplant');
  await form.searchField().fill('eggpl');
  await expect(form.searchResult('Eggplant is already an ingredient')).toBeVisible();
  await form.searchField().fill('');
  await form.addCustomIngredient('Ricotta salata');
  await expect.poll(() => form.ingredientNames()).toEqual(['Eggplant', 'Ricotta salata']);

  await form.save();
  await expect.poll(() => dishesPage.names(dishesPage.suggestedSection())).toEqual(['Pasta alla Norma']);
  await expect(dishesPage.inListSection()).toContainText('No dishes in the list yet.');
});

test('new dish: back arrow, Cancel and browser Back create nothing', async ({ pageForUser }) => {
  const owner = await registerNamedUser('CreateExit');
  const list = await createShoppingListViaApi(owner, [], 'e2e-dish-exit');
  const page = await pageForUser(owner.email, owner.password);
  const dishesPage = new DishesPage(page);
  const form = new DishFormPage(page);

  await dishesPage.goto(list.id);

  await dishesPage.newDish();
  await form.fillName('Draft');
  await form.addIngredient('onio', 'Onions');
  await form.back();

  await dishesPage.newDish();
  await form.fillName('Draft');
  await form.cancel();

  await dishesPage.newDish();
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/lists/${list.id}/dishes$`));

  await expect(dishesPage.suggestedSection()).toContainText('No dishes to suggest.');
});

test('new dish: a photo picked before saving shows on the card', async ({ pageForUser }) => {
  const owner = await registerNamedUser('CreatePhoto');
  const list = await createShoppingListViaApi(owner, [], 'e2e-dish-photo');
  const page = await pageForUser(owner.email, owner.password);
  const dishesPage = new DishesPage(page);
  const form = new DishFormPage(page);

  await dishesPage.goto(list.id);
  await dishesPage.newDish();
  await form.uploadPhoto();
  await expect(page.getByTestId('dish-photo').locator('img')).toHaveAttribute('src', /^blob:/);
  await form.fillName('Photo soup');
  await form.addIngredient('onio', 'Onions');
  await form.save();

  await expect(dishesPage.card('Photo soup').locator('img')).toHaveAttribute('src', /^data:image\/webp;base64,/);
});
