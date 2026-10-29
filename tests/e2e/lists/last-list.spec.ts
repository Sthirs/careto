import { test, expect } from '../fixtures/auth';
import { ShoppingListsPage } from '../pages';

// docs/specifications.md: the app opens to the last shopping list the user was viewing.
test('the app reopens the last viewed list on launch', async ({ authenticatedPage: page }) => {
  const shoppingListsPage = new ShoppingListsPage(page);
  const shoppingListName = 'e2e-last-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);

  await page.goto('/lists');
  await shoppingListsPage.createShoppingList(shoppingListName);
  await shoppingListsPage.openShoppingList(shoppingListName);
  await expect(page).toHaveURL(/\/lists\/[^/]+$/);
  const listUrl = page.url();

  // Launching the app on the root URL lands on that list, not on My lists.
  await page.goto('/');
  await expect(page).toHaveURL(listUrl);
  await expect(page.getByRole('heading', { level: 1, name: shoppingListName })).toBeVisible();

  // Opening My lists directly still shows the overview.
  await page.goto('/lists');
  await expect(page).toHaveURL(/\/lists$/);
});
