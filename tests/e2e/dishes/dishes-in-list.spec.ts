// When a dish is "in the list" (ADR-0024): it has an ingredient still to buy
// because the dish was added. Items added by hand never count.
import { test, expect } from '../fixtures/auth';
import {
  addDishToListViaApi,
  addItemViaApi,
  buyItemsViaApi,
  createDishViaApi,
} from '../fixtures/dishes';
import { createShoppingListViaApi, registerNamedUser } from '../fixtures/lists';
import { DishesPage, ShoppingListDetailPage } from '../pages';

const setup = async (
  pageForUser: (email: string, password: string) => Promise<import('@playwright/test').Page>,
  prefix: string,
) => {
  const owner = await registerNamedUser(prefix);
  const list = await createShoppingListViaApi(owner, [], `e2e-${prefix.toLowerCase()}`);
  const page = await pageForUser(owner.email, owner.password);
  return { owner, list, page, dishesPage: new DishesPage(page), listPage: new ShoppingListDetailPage(page) };
};

const sorted = async (names: Promise<string[]>) => (await names).sort();

test('in the list: add puts the ingredients on the list, undo takes them off', async ({ pageForUser }) => {
  const { owner, list, page, dishesPage, listPage } = await setup(pageForUser, 'InList');
  await createDishViaApi(owner, list.id, {
    name: 'Lasagna',
    ingredients: [{ catalogItemKey: 'pasta' }, { catalogItemKey: 'ground-meat' }],
  });

  await dishesPage.goto(list.id);
  await dishesPage.addToList('Lasagna');
  await expect.poll(() => dishesPage.names(dishesPage.inListSection())).toEqual(['Lasagna']);
  await expect(dishesPage.suggestedSection()).toContainText('Nothing else to suggest right now.');

  await dishesPage.openListTab();
  await expect.poll(() => sorted(listPage.tileNames(listPage.toBuyList()))).toEqual(['Ground meat', 'Pasta']);

  await page.goto(`/lists/${list.id}/dishes`);
  await dishesPage.undo('Lasagna');
  await expect.poll(() => dishesPage.names(dishesPage.suggestedSection())).toEqual(['Lasagna']);
  await expect(dishesPage.inListSection()).toContainText('No dishes in the list yet.');

  await dishesPage.openListTab();
  await expect(page.getByTestId('list-empty')).toBeVisible();
});

test('in the list: stays until every ingredient is bought', async ({ pageForUser }) => {
  const { owner, list, page, dishesPage, listPage } = await setup(pageForUser, 'InListBuy');
  const dish = await createDishViaApi(owner, list.id, {
    name: 'Lasagna',
    ingredients: [{ catalogItemKey: 'pasta' }, { catalogItemKey: 'ground-meat' }],
  });
  await addDishToListViaApi(owner, list.id, dish.id);

  await page.goto(`/lists/${list.id}`);
  await listPage.markBought('Pasta');
  await expect(listPage.lastUsedList().getByText('Pasta')).toBeVisible();
  await dishesPage.goto(list.id);
  await expect.poll(() => dishesPage.names(dishesPage.inListSection())).toEqual(['Lasagna']);

  await page.goto(`/lists/${list.id}`);
  await listPage.markBought('Ground meat');
  await expect(listPage.lastUsedList().getByText('Ground meat')).toBeVisible();
  await dishesPage.goto(list.id);
  await expect.poll(() => dishesPage.names(dishesPage.suggestedSection())).toEqual(['Lasagna']);
});

test('in the list: an item added by hand does not put a dish in the list', async ({ pageForUser }) => {
  const { owner, list, page, dishesPage, listPage } = await setup(pageForUser, 'InListManual');
  await createDishViaApi(owner, list.id, { name: 'Pasta', ingredients: [{ catalogItemKey: 'pasta' }] });

  await page.goto(`/lists/${list.id}`);
  await listPage.addFromSearch('pasta', 'Pasta');
  await expect.poll(() => listPage.tileNames(listPage.toBuyList())).toEqual(['Pasta']);

  await dishesPage.goto(list.id);
  await expect.poll(() => dishesPage.names(dishesPage.suggestedSection())).toEqual(['Pasta']);
  await expect(dishesPage.inListSection()).toContainText('No dishes in the list yet.');
});

test('in the list: undo keeps an item added by hand', async ({ pageForUser }) => {
  const { owner, list, dishesPage, listPage } = await setup(pageForUser, 'InListKeep');
  await addItemViaApi(owner, list.id, 'onions');
  const dish = await createDishViaApi(owner, list.id, {
    name: 'Soup',
    ingredients: [{ catalogItemKey: 'onions' }, { catalogItemKey: 'canned-tomatoes' }],
  });
  await addDishToListViaApi(owner, list.id, dish.id);

  await dishesPage.goto(list.id);
  await dishesPage.undo('Soup');
  await expect.poll(() => dishesPage.names(dishesPage.suggestedSection())).toEqual(['Soup']);

  await dishesPage.openListTab();
  await expect.poll(() => listPage.tileNames(listPage.toBuyList())).toEqual(['Onions']);
});

test('in the list: undo keeps an ingredient another dish still needs', async ({ pageForUser }) => {
  const { owner, list, dishesPage, listPage } = await setup(pageForUser, 'InListShared');
  const lasagna = await createDishViaApi(owner, list.id, {
    name: 'Lasagna',
    ingredients: [{ catalogItemKey: 'pasta' }, { catalogItemKey: 'mozzarella' }],
  });
  const pizza = await createDishViaApi(owner, list.id, { name: 'Pizza', ingredients: [{ catalogItemKey: 'mozzarella' }] });
  await addDishToListViaApi(owner, list.id, lasagna.id);
  await addDishToListViaApi(owner, list.id, pizza.id);

  await dishesPage.goto(list.id);
  await expect.poll(() => dishesPage.names(dishesPage.inListSection())).toEqual(['Lasagna', 'Pizza']);
  await dishesPage.undo('Lasagna');
  await expect.poll(() => dishesPage.names(dishesPage.inListSection())).toEqual(['Pizza']);

  await dishesPage.openListTab();
  await expect.poll(() => listPage.tileNames(listPage.toBuyList())).toEqual(['Mozzarella']);
});

test('in the list: swiping away its items puts the dish back in Suggested', async ({ pageForUser }) => {
  const { owner, list, page, dishesPage, listPage } = await setup(pageForUser, 'InListSwipe');
  const dish = await createDishViaApi(owner, list.id, { name: 'Pasta', ingredients: [{ catalogItemKey: 'pasta' }] });
  await addDishToListViaApi(owner, list.id, dish.id);

  await page.goto(`/lists/${list.id}`);
  await listPage.swipeRemove('Pasta');
  await expect(page.getByTestId('list-empty')).toBeVisible();

  await dishesPage.goto(list.id);
  await expect.poll(() => dishesPage.names(dishesPage.suggestedSection())).toEqual(['Pasta']);
});

test('in the list: adding a dish moves a bought ingredient back to buy', async ({ pageForUser }) => {
  const { owner, list, dishesPage, listPage } = await setup(pageForUser, 'InListBack');
  await addItemViaApi(owner, list.id, 'pasta');
  await buyItemsViaApi(owner, list.id, ['pasta']);
  await createDishViaApi(owner, list.id, { name: 'Pasta', ingredients: [{ catalogItemKey: 'pasta' }] });

  await dishesPage.goto(list.id);
  await dishesPage.addToList('Pasta');
  await expect.poll(() => dishesPage.names(dishesPage.inListSection())).toEqual(['Pasta']);

  await dishesPage.openListTab();
  await expect.poll(() => listPage.tileNames(listPage.toBuyList())).toEqual(['Pasta']);
  await expect(listPage.lastUsedList()).toHaveCount(0);
});

test('in the list: undo keeps an ingredient another member added by hand meanwhile', async ({ pageForUser }) => {
  const { owner, list, dishesPage, listPage } = await setup(pageForUser, 'InListClaim');
  const dish = await createDishViaApi(owner, list.id, { name: 'Salad', ingredients: [{ catalogItemKey: 'tomatoes' }] });
  await addDishToListViaApi(owner, list.id, dish.id);
  // Another member, on a screen that has not refreshed yet, adds it by hand.
  await addItemViaApi(owner, list.id, 'tomatoes');

  await dishesPage.goto(list.id);
  await dishesPage.undo('Salad');
  await expect.poll(() => dishesPage.names(dishesPage.suggestedSection())).toEqual(['Salad']);

  await dishesPage.openListTab();
  await expect.poll(() => listPage.tileNames(listPage.toBuyList())).toEqual(['Tomatoes']);
});

test('in the list: undo returns a bought item that the dish put back to Last used', async ({ pageForUser }) => {
  const { owner, list, dishesPage, listPage } = await setup(pageForUser, 'InListRestore');
  await addItemViaApi(owner, list.id, 'onions');
  await buyItemsViaApi(owner, list.id, ['onions']);
  await createDishViaApi(owner, list.id, { name: 'Soup', ingredients: [{ catalogItemKey: 'onions' }] });

  await dishesPage.goto(list.id);
  await dishesPage.addToList('Soup');
  await expect.poll(() => dishesPage.names(dishesPage.inListSection())).toEqual(['Soup']);
  await dishesPage.undo('Soup');
  await expect.poll(() => dishesPage.names(dishesPage.suggestedSection())).toEqual(['Soup']);

  await dishesPage.openListTab();
  await expect(listPage.toBuyList()).toHaveCount(0);
  await expect(listPage.lastUsedList().getByText('Onions')).toBeVisible();
});

test('in the list: putting back a mistakenly bought ingredient puts the dish back', async ({ pageForUser }) => {
  const { owner, list, page, dishesPage, listPage } = await setup(pageForUser, 'InListUnbuy');
  const dish = await createDishViaApi(owner, list.id, { name: 'Pasta', ingredients: [{ catalogItemKey: 'pasta' }] });
  await addDishToListViaApi(owner, list.id, dish.id);

  await page.goto(`/lists/${list.id}`);
  await listPage.markBought('Pasta');
  await listPage.addBack('Pasta');
  await expect.poll(() => listPage.tileNames(listPage.toBuyList())).toEqual(['Pasta']);

  await dishesPage.goto(list.id);
  await expect.poll(() => dishesPage.names(dishesPage.inListSection())).toEqual(['Pasta']);
});
