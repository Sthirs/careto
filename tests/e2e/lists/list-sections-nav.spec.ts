// The "List sections" bottom bar (ListSectionsNav.vue) moves between the four
// sections of one list; Week is a placeholder until built.
import { test, expect } from '../fixtures/auth';
import { ShoppingListsPage, ShoppingListDetailPage } from '../pages';

test('list sections bar: List → Dishes → Week → Settings → List', async ({
  authenticatedPage: page,
}) => {
  const shoppingListsPage = new ShoppingListsPage(page);
  const detailPage = new ShoppingListDetailPage(page);

  await page.goto('/lists');
  const shoppingListName = 'e2e-sections-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
  await shoppingListsPage.createShoppingList(shoppingListName);
  await shoppingListsPage.openShoppingList(shoppingListName);
  const shoppingListId = await detailPage.getShoppingListId();

  const nav = detailPage.sectionsNav();
  await expect(page.getByRole('heading', { name: shoppingListName, level: 1 })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'List', exact: true })).toHaveAttribute('aria-current', 'page');

  await detailPage.openSection('Dishes');
  await expect(page).toHaveURL(new RegExp(`/lists/${shoppingListId}/dishes$`));
  await expect(page.getByRole('heading', { name: 'Dishes', level: 1 })).toBeVisible();
  await expect(page.getByTestId('dishes-suggested')).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Dishes' })).toHaveAttribute('aria-current', 'page');

  await detailPage.openSection('Week');
  await expect(page).toHaveURL(new RegExp(`/lists/${shoppingListId}/week$`));
  await expect(page.getByRole('heading', { name: 'Week', level: 1 })).toBeVisible();
  await expect(page.getByTestId('section-coming-soon')).toBeVisible();

  await detailPage.openSection('Settings');
  await expect(page).toHaveURL(new RegExp(`/lists/${shoppingListId}/settings$`));
  await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();
  await expect(page.getByTestId('list-name-input')).toHaveValue(shoppingListName);
  await expect(page.getByRole('heading', { name: 'Members', level: 2 })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Settings' })).toHaveAttribute('aria-current', 'page');

  await detailPage.openSection('List');
  await expect(page).toHaveURL(new RegExp(`/lists/${shoppingListId}$`));
  await expect(page.getByRole('heading', { name: shoppingListName, level: 1 })).toBeVisible();

  // Every section's back arrow leads to My lists (ADR-0022).
  await detailPage.openSection('Week');
  await detailPage.clickBackToShoppingLists();
  await expect(page.getByRole('heading', { name: 'My lists', level: 1 })).toBeVisible();
});
