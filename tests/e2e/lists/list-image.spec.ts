import { test, expect } from '../fixtures/auth';
import { ShoppingListsPage, ShoppingListSettingsPage } from '../pages';
import { resolve } from 'node:path';

const FIXTURE_PATH = resolve('tests/e2e/fixtures/test-image.png');

test('list image: upload in settings → appears on list card → persists after reload', async ({
  authenticatedPage: page,
}) => {
  const shoppingListsPage = new ShoppingListsPage(page);
  const shoppingListSettingsPage = new ShoppingListSettingsPage(page);

  // 1. Navigate to /lists and create a list
  await page.goto('/lists');
  const shoppingListName = 'e2e-list-image-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
  await shoppingListsPage.createShoppingList(shoppingListName);
  await shoppingListsPage.expectShoppingListVisible(shoppingListName);

  // 2. Open list detail and navigate to settings
  await shoppingListsPage.openShoppingList(shoppingListName);
  const shoppingListId = page.url().split('/').pop();
  expect(shoppingListId).toBeTruthy();
  await page.goto('/lists/' + shoppingListId + '/settings');

  // 3. Verify the "Change image" pill is visible with its inline camera icon
  await expect(shoppingListSettingsPage.imageEditButton).toBeVisible();
  await expect(shoppingListSettingsPage.imageEditButton).toHaveText('Change image');
  await expect(shoppingListSettingsPage.imageEditButton.locator('svg')).toBeVisible();

  // 4. Upload image via hidden file input
  await shoppingListSettingsPage.imageInput.setInputFiles(FIXTURE_PATH);

  // 5. Preview image shows the uploaded image (data: URL) - backend may convert to webp
  await expect(shoppingListSettingsPage.previewImage).toBeVisible();
  await expect(shoppingListSettingsPage.previewImage).toHaveAttribute('src', /^data:image\/(png|webp);base64,/);

  // 6. Go back to lists list and verify list card shows the image
  await page.goto('/lists');
  await shoppingListsPage.expectShoppingListVisible(shoppingListName);

  // The list card should now show an <img> with the uploaded image (not the gradient placeholder)
  const shoppingListCard = page.locator('li', { has: page.getByRole('heading', { name: shoppingListName, level: 2 }) });
  await expect(shoppingListCard.locator('img').first()).toBeVisible();
  await expect(shoppingListCard.locator('img').first()).toHaveAttribute('src', /^data:image\/(png|webp);base64,/);
  // Gradient thumbnail should not be visible when image is set
  await expect(shoppingListCard.locator('div[aria-label*="thumbnail"]')).not.toBeVisible();

  // 7. Reload and verify persistence
  await page.reload();
  await shoppingListsPage.expectShoppingListVisible(shoppingListName);
  const shoppingListCardAfterReload = page.locator('li', { has: page.getByRole('heading', { name: shoppingListName, level: 2 }) });
  await expect(shoppingListCardAfterReload.locator('img').first()).toBeVisible();
  await expect(shoppingListCardAfterReload.locator('img').first()).toHaveAttribute('src', /^data:image\/(png|webp);base64,/);
});
