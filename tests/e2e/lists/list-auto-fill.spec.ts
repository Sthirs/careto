// docs/specifications.md §Learning and Planning (ADR-0027): the list fills
// itself with recurring products as soon as they are due. The seeder rebuilds
// the demo user's "Dispensa" list on every startup with a back-dated purchase
// history, and the auto-fill run right after the seed adds its due products.
// The spec only reads the list, so it holds on every run after a deploy.
import { test, expect } from '../fixtures/auth';
import { ShoppingListDetailPage, ShoppingListsPage } from '../pages';

test('the list fills itself with products that are due again', async ({ authenticatedPage: page }) => {
  const shoppingListsPage = new ShoppingListsPage(page);
  const detailPage = new ShoppingListDetailPage(page);

  await page.goto('/lists');
  await shoppingListsPage.openShoppingList('Dispensa');

  // Milk and Bread were bought by hand every week: they are back to buy,
  // each with the automatic planner's badge.
  await expect.poll(async () => (await detailPage.tileNames(detailPage.toBuyList())).sort()).toEqual([
    'Bread',
    'Milk',
  ]);
  const badges = detailPage.toBuyList().getByTestId('from-planner-badge');
  await expect(badges).toHaveCount(2);
  await expect(badges.first()).toHaveAttribute('aria-label', 'Added by the automatic planner');

  // Mozzarella was only ever bought for dishes: it stays under Last used.
  await expect(detailPage.lastUsedList().getByText('Mozzarella')).toBeVisible();
});
