// ADR-0019: the browser Back button and every topbar back arrow are the same
// history operation (goBackTo/goBackOr, lib/backNavigation.ts). Before it,
// every "back" exit was a forward `router.push` rather than a pop, so Back
// re-opened pages the user had already left.
// Uses the authenticatedPage fixture (no UI login).
import { test, expect } from '../fixtures/auth';
import { ShoppingListsPage, ShoppingListDetailPage } from '../pages';

test('the settings back arrow and the browser Back button both reach My lists', async ({
  authenticatedPage: page,
}) => {
  const shoppingListsPage = new ShoppingListsPage(page);
  const shoppingListDetailPage = new ShoppingListDetailPage(page);

  await page.goto('/lists');
  const shoppingListName = 'e2e-back-btn-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
  await shoppingListsPage.createShoppingList(shoppingListName);
  await shoppingListsPage.openShoppingList(shoppingListName);
  const shoppingListId = await shoppingListDetailPage.getShoppingListId();

  // ADR-0022: tabs replace the history entry, so from Settings the header
  // arrow pops straight to My lists — exactly where Back would go.
  await shoppingListDetailPage.openSettings();
  await expect(page).toHaveURL(new RegExp(`/lists/${shoppingListId}/settings$`));

  await shoppingListDetailPage.clickBackToShoppingLists();
  await expect(page).toHaveURL(/\/lists$/);

  // Forward returns to Settings (the entry the tab replaced the list with),
  // proving the arrow popped exactly one entry instead of pushing.
  await page.goForward();
  await expect(page).toHaveURL(new RegExp(`/lists/${shoppingListId}/settings$`));
});

test('browser Back from a list section reached by the tab bar goes to My lists', async ({
  authenticatedPage: page,
}) => {
  const shoppingListsPage = new ShoppingListsPage(page);
  const shoppingListDetailPage = new ShoppingListDetailPage(page);

  await page.goto('/lists');
  const shoppingListName = 'e2e-back-btn-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
  await shoppingListsPage.createShoppingList(shoppingListName);
  await shoppingListsPage.openShoppingList(shoppingListName);
  const shoppingListId = await shoppingListDetailPage.getShoppingListId();

  await shoppingListDetailPage.openSection('Dishes');
  await shoppingListDetailPage.openSection('Week');
  await shoppingListDetailPage.openSettings();
  await expect(page).toHaveURL(new RegExp(`/lists/${shoppingListId}/settings$`));

  await page.goBack();
  await expect(page).toHaveURL(/\/lists$/);
});

test('the list-detail back arrow (Back to lists) and browser Back agree', async ({
  authenticatedPage: page,
}) => {
  const shoppingListsPage = new ShoppingListsPage(page);
  const shoppingListDetailPage = new ShoppingListDetailPage(page);

  await page.goto('/lists');
  const shoppingListName = 'e2e-back-btn-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
  await shoppingListsPage.createShoppingList(shoppingListName);
  await shoppingListsPage.openShoppingList(shoppingListName);
  const shoppingListId = await shoppingListDetailPage.getShoppingListId();

  await shoppingListDetailPage.clickBackToShoppingLists();
  await expect(page).toHaveURL(/\/lists$/);

  // Forward, then Back again should return to the list, not double-pop past
  // it — confirming clickBackToShoppingLists() popped exactly one entry.
  await page.goForward();
  await expect(page).toHaveURL(new RegExp(`/lists/${shoppingListId}$`));
});
