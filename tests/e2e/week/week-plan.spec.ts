// Week plan (ADR-0025): one rolling plan per list, slots keyed by weekday.
import { test, expect } from '../fixtures/auth';
import { createDishViaApi } from '../fixtures/dishes';
import { api, createShoppingListViaApi, registerNamedUser } from '../fixtures/lists';
import { ShoppingListDetailPage, WeekPage } from '../pages';

const setup = async (
  pageForUser: (email: string, password: string) => Promise<import('@playwright/test').Page>,
  prefix: string,
) => {
  const owner = await registerNamedUser(prefix);
  const list = await createShoppingListViaApi(owner, [], `e2e-${prefix.toLowerCase()}`);
  const page = await pageForUser(owner.email, owner.password);
  return { owner, list, page, weekPage: new WeekPage(page), listPage: new ShoppingListDetailPage(page) };
};

const sorted = async (names: Promise<string[]>) => (await names).sort();

test('week: search a dish for a slot, add the plan to the list, items show the dish badge', async ({ pageForUser }) => {
  const { owner, list, page, weekPage, listPage } = await setup(pageForUser, 'WeekPlan');
  await createDishViaApi(owner, list.id, {
    name: 'Pasta al pomodoro',
    ingredients: [{ catalogItemKey: 'pasta' }, { catalogItemKey: 'tomatoes' }],
  });
  await createDishViaApi(owner, list.id, { name: 'Pollo al limone', ingredients: [{ catalogItemKey: 'lemon' }] });

  await weekPage.goto(list.id);
  await expect(weekPage.plannedCount()).toHaveText('0 of 14 meals planned');
  await expect(weekPage.addButton()).toBeDisabled();

  await weekPage.openSlot('Monday dinner');
  await expect(weekPage.picker()).toContainText('Dish for Monday dinner');
  await weekPage.searchDish('pomo');
  await expect(weekPage.choice('Pollo al limone')).toHaveCount(0);
  await weekPage.choose('Pasta al pomodoro');

  await expect.poll(() => weekPage.dishIn('Monday dinner')).toBe('Pasta al pomodoro');
  await expect(weekPage.plannedCount()).toHaveText('1 of 14 meals planned');

  await weekPage.addToList();
  await expect(weekPage.addButton()).toHaveText('Added to the list');
  await expect(page.getByText('Ingredients of the planned dishes added to the list')).toBeAttached();
  await expect(weekPage.addButton()).toHaveText('Add ingredients to list');
  await expect.poll(() => weekPage.dishIn('Monday dinner')).toBe('Pasta al pomodoro');

  await weekPage.openListTab();
  await expect.poll(() => sorted(listPage.tileNames(listPage.toBuyList()))).toEqual(['Pasta', 'Tomatoes']);
  await expect(listPage.toBuyList().getByTestId('from-dish-badge')).toHaveCount(2);
  await expect(listPage.toBuyList().getByRole('img', { name: 'For a dish' }).first()).toBeVisible();
});

test('week: a hand-added item has no dish badge', async ({ pageForUser }) => {
  const { owner, list, page, listPage } = await setup(pageForUser, 'WeekBadge');
  await api(owner.token, 'POST', `/lists/${list.id}/items`, { catalogItemKey: 'milk' });

  await page.goto(`/lists/${list.id}`);
  await expect.poll(() => listPage.tileNames(listPage.toBuyList())).toEqual(['Milk']);
  await expect(listPage.toBuyList().getByTestId('from-dish-badge')).toHaveCount(0);
});

test('week: change the dish of a slot', async ({ pageForUser }) => {
  const { owner, list, page, weekPage } = await setup(pageForUser, 'WeekChange');
  const pasta = await createDishViaApi(owner, list.id, { name: 'Pasta al pomodoro', ingredients: [{ catalogItemKey: 'pasta' }] });
  await createDishViaApi(owner, list.id, { name: 'Minestrone', ingredients: [{ catalogItemKey: 'carrots' }] });
  await api(owner.token, 'PUT', `/lists/${list.id}/week/slots`, { weekday: 3, meal: 'lunch', dishId: pasta.id });

  await weekPage.goto(list.id);
  await expect.poll(() => weekPage.dishIn('Wednesday lunch')).toBe('Pasta al pomodoro');

  await weekPage.openSlot('Wednesday lunch');
  await expect(weekPage.picker()).toContainText('Now: Pasta al pomodoro');
  await expect(weekPage.choice('Pasta al pomodoro')).toHaveAttribute('aria-current', 'true');
  await weekPage.choose('Minestrone');
  await expect.poll(() => weekPage.dishIn('Wednesday lunch')).toBe('Minestrone');

  await page.reload();
  await expect.poll(() => weekPage.dishIn('Wednesday lunch')).toBe('Minestrone');
  await expect(weekPage.plannedCount()).toHaveText('1 of 14 meals planned');
});

test('week: remove a dish from a slot, with the ✕ and from the picker, and undo', async ({ pageForUser }) => {
  const { owner, list, page, weekPage } = await setup(pageForUser, 'WeekRemove');
  const pasta = await createDishViaApi(owner, list.id, { name: 'Pasta al pomodoro', ingredients: [{ catalogItemKey: 'pasta' }] });
  await api(owner.token, 'PUT', `/lists/${list.id}/week`, {
    slots: [
      { weekday: 1, meal: 'dinner', dishId: pasta.id },
      { weekday: 5, meal: 'lunch', dishId: pasta.id },
    ],
  });

  await weekPage.goto(list.id);
  await expect(weekPage.plannedCount()).toHaveText('2 of 14 meals planned');

  await weekPage.remove('Pasta al pomodoro', 'Monday dinner');
  await expect(weekPage.slot('Monday dinner')).toHaveAttribute('data-empty', 'true');
  await expect(weekPage.toast()).toContainText('Pasta al pomodoro removed from Monday dinner');
  await weekPage.undo();
  await expect.poll(() => weekPage.dishIn('Monday dinner')).toBe('Pasta al pomodoro');

  await weekPage.openSlot('Friday lunch');
  await weekPage.removeFromPicker();
  await expect(weekPage.slot('Friday lunch')).toHaveAttribute('data-empty', 'true');
  await expect(weekPage.toast()).toContainText('Pasta al pomodoro removed from Friday lunch');

  await page.reload();
  await expect(weekPage.slot('Friday lunch')).toHaveAttribute('data-empty', 'true');
  await expect(weekPage.plannedCount()).toHaveText('1 of 14 meals planned');
});

test('week: a new plan clears every slot and can be undone', async ({ pageForUser }) => {
  const { owner, list, weekPage } = await setup(pageForUser, 'WeekNewPlan');
  const pasta = await createDishViaApi(owner, list.id, { name: 'Pasta al pomodoro', ingredients: [{ catalogItemKey: 'pasta' }] });
  await api(owner.token, 'PUT', `/lists/${list.id}/week`, {
    slots: [
      { weekday: 2, meal: 'lunch', dishId: pasta.id },
      { weekday: 7, meal: 'dinner', dishId: pasta.id },
    ],
  });

  await weekPage.goto(list.id);
  await weekPage.startNewPlan();
  await expect(weekPage.plannedCount()).toHaveText('0 of 14 meals planned');
  await expect(weekPage.toast()).toContainText('Week plan cleared');

  await weekPage.undo();
  await expect(weekPage.plannedCount()).toHaveText('2 of 14 meals planned');
  await expect.poll(() => weekPage.dishIn('Sunday dinner')).toBe('Pasta al pomodoro');
});

test('week: browser Back closes the dish picker', async ({ pageForUser }) => {
  const { owner, list, page, weekPage } = await setup(pageForUser, 'WeekBack');
  await createDishViaApi(owner, list.id, { name: 'Minestrone', ingredients: [{ catalogItemKey: 'carrots' }] });

  await weekPage.goto(list.id);
  await weekPage.openSlot('Tuesday lunch');
  await expect(page).toHaveURL(/overlay=week-dish/);
  await page.goBack();
  await expect(weekPage.picker()).toBeHidden();
  await expect(page).toHaveURL(new RegExp(`/lists/${list.id}/week$`));
});
