// Pausing a dish takes it out of Suggested until a date; resuming brings it back.
import { test, expect } from '../fixtures/auth';
import { createDishViaApi } from '../fixtures/dishes';
import { createShoppingListViaApi, registerNamedUser } from '../fixtures/lists';
import { DishesPage, DishFormPage } from '../pages';

const isoInDays = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

test('pause: 1 week from the Dish screen, then resume from the card', async ({ pageForUser }) => {
  const owner = await registerNamedUser('Pause');
  const list = await createShoppingListViaApi(owner, [], 'e2e-dish-pause');
  await createDishViaApi(owner, list.id, { name: 'Lasagna', ingredients: [{ catalogItemKey: 'pasta' }] });
  const page = await pageForUser(owner.email, owner.password);
  const dishesPage = new DishesPage(page);
  const form = new DishFormPage(page);

  await dishesPage.goto(list.id);
  await dishesPage.openEdit('Lasagna');
  await form.pause('1 week');
  await expect(page.getByText(/^Paused until /).first()).toBeVisible();
  await form.back();

  await expect(dishesPage.pausedSection().getByTestId('paused-count')).toHaveText('1');
  await expect.poll(() => dishesPage.names(dishesPage.pausedSection())).toEqual(['Lasagna']);
  await expect(dishesPage.suggestedSection()).toContainText('Nothing else to suggest right now.');

  // The Paused header collapses and expands the section.
  const toggle = dishesPage.pausedSection().getByRole('button', { name: /^Paused/ });
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(dishesPage.card('Lasagna')).toHaveCount(0);
  await toggle.click();
  await expect(dishesPage.card('Lasagna')).toBeVisible();

  await dishesPage.resume('Lasagna');
  await expect.poll(() => dishesPage.names(dishesPage.suggestedSection())).toEqual(['Lasagna']);
  await expect(dishesPage.pausedSection()).toHaveCount(0);
});

test('pause: pick a date, then resume from the Dish screen', async ({ pageForUser }) => {
  const owner = await registerNamedUser('PausePick');
  const list = await createShoppingListViaApi(owner, [], 'e2e-dish-pause-pick');
  await createDishViaApi(owner, list.id, { name: 'Soup', ingredients: [{ catalogItemKey: 'onions' }] });
  const page = await pageForUser(owner.email, owner.password);
  const dishesPage = new DishesPage(page);
  const form = new DishFormPage(page);
  const date = isoInDays(40);
  const label = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short' }).format(
    new Date(`${date}T00:00:00`),
  );

  await dishesPage.goto(list.id);
  await dishesPage.openEdit('Soup');
  await form.pause({ date });
  await expect(page.getByText(`Paused until ${label}`).first()).toBeVisible();

  await form.resume();
  await expect(page.getByRole('button', { name: /^Pause this dish/ })).toBeVisible();
  await form.back();
  await expect.poll(() => dishesPage.names(dishesPage.suggestedSection())).toEqual(['Soup']);
});

test('pause: browser Back closes the pause sheet and stays on the Dish screen', async ({ pageForUser }) => {
  const owner = await registerNamedUser('PauseBack');
  const list = await createShoppingListViaApi(owner, [], 'e2e-dish-pause-back');
  await createDishViaApi(owner, list.id, { name: 'Soup', ingredients: [{ catalogItemKey: 'onions' }] });
  const page = await pageForUser(owner.email, owner.password);
  const dishesPage = new DishesPage(page);
  const form = new DishFormPage(page);

  await dishesPage.goto(list.id);
  await dishesPage.openEdit('Soup');
  await page.getByRole('button', { name: /^Pause this dish/ }).click();
  await expect(form.pauseSheet()).toBeVisible();

  await page.goBack();
  await expect(form.pauseSheet()).toBeHidden();
  await expect(page).toHaveURL(/\/dishes\/[0-9a-f-]{36}$/);
});

test('pause: a pause date in the past means Suggested', async ({ pageForUser }) => {
  const owner = await registerNamedUser('PausePast');
  const list = await createShoppingListViaApi(owner, [], 'e2e-dish-pause-past');
  await createDishViaApi(owner, list.id, {
    name: 'Soup',
    ingredients: [{ catalogItemKey: 'onions' }],
    pausedUntil: isoInDays(-3),
  });
  const page = await pageForUser(owner.email, owner.password);
  const dishesPage = new DishesPage(page);

  await dishesPage.goto(list.id);
  await expect.poll(() => dishesPage.names(dishesPage.suggestedSection())).toEqual(['Soup']);
  await expect(dishesPage.pausedSection()).toHaveCount(0);
});
