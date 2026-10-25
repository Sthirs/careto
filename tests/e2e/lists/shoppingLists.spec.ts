// No delete-list step: backend has no DELETE /api/lists/:id (decision A2).
import { test, expect } from '../fixtures/auth';
import { ShoppingListsPage, ShoppingListSettingsPage, acceptInvitationViaApi } from '../pages';

test('list lifecycle: create → invite Alice → rename', async ({ authenticatedPage: page }) => {
  const shoppingListsPage = new ShoppingListsPage(page);
  const shoppingListSettingsPage = new ShoppingListSettingsPage(page);

  // 1. Navigate to /lists.
  await page.goto('/lists');

  // 2. Unique list name pattern (same as apps/backend/tests/integration/helpers/api.ts:59 uniqueValue).
  const shoppingListName = 'e2e-list-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);

  // 3-4. Create the list and assert it appears in the list.
  await shoppingListsPage.createShoppingList(shoppingListName);
  await shoppingListsPage.expectShoppingListVisible(shoppingListName);

  // 5. Open the list detail, capture the id from the URL, then jump to settings via URL
  //    (not by clicking the Settings button — too fragile across mobile/desktop layouts).
  await shoppingListsPage.openShoppingList(shoppingListName);
  const shoppingListId = page.url().split('/').pop();
  expect(shoppingListId).toBeTruthy();
  await page.goto('/lists/' + shoppingListId + '/settings');

  // 6-7. Invite Alice by email and assert her display name appears in the member list
  //      (Alice Rossi is from seedService.ts:19). Under the invitation system
  //      (ADR-0011) Alice is only invited until she accepts, so the accept step
  //      is performed via the API helper before asserting membership.
  await shoppingListSettingsPage.inviteByEmail('alice@careto.local');
  await acceptInvitationViaApi(page, shoppingListId!, 'alice@careto.local', 'password123');
  await page.reload();
  await shoppingListSettingsPage.expectMemberVisible('Alice Rossi');

  // 8. Rename the list.
  await shoppingListSettingsPage.rename(shoppingListName + '-renamed');

  // 9-10. Reload the settings page and assert the name input contains the new name
  //       (confirms PATCH persisted).
  await page.goto('/lists/' + shoppingListId + '/settings');
  await shoppingListSettingsPage.expectNameValue(shoppingListName + '-renamed');
});
