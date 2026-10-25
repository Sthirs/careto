import { test, expect } from '../fixtures/auth';

test('lists overview matches UI design: thumbnails and avatars', async ({ authenticatedPage: page }) => {
  // 1. Login flow — authenticatedPage fixture handles this, so just navigate
  await page.goto('/lists');

  // 2. Wait for the lists overview to load, then assert at least the 2 seeded
  //    lists the demo user belongs to (test-created lists from concurrent specs
  //    may add to the count).
  await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible({ timeout: 10000 });
  const headingCount = await page.getByRole('heading', { level: 2 }).count();
  expect(headingCount).toBeGreaterThanOrEqual(2);

  // 3. Mercà de Rialto — gradient thumbnail (no img), 2 members (demo + alice)
  const rialtoCard = page.locator('li').filter({
    has: page.getByRole('heading', { name: 'Mercà de Rialto', exact: true, level: 2 }),
  });
  await expect(rialtoCard).toBeVisible();
  await expect(rialtoCard.locator('div[aria-label*="thumbnail"]')).toBeVisible();
  await expect(rialtoCard.getByLabel('Demo User')).toBeVisible();
  await expect(rialtoCard.getByLabel('Alice Rossi')).toBeVisible();

  // 4. Spesa dea setimana has 3 members (demo + alice + bob) — "+N" NOT shown since count = 3
  const weeklyCard = page.locator('li').filter({
    has: page.getByRole('heading', { name: 'Spesa dea setimana', level: 2 }),
  });
  await expect(weeklyCard.getByLabel('Demo User')).toBeVisible();
  await expect(weeklyCard.getByLabel('Alice Rossi')).toBeVisible();
  await expect(weeklyCard.getByLabel('Bob Bianchi')).toBeVisible();
  await expect(weeklyCard.locator('text=/^\\+\\d+$/')).not.toBeVisible();

  // 5. Office Pantry should NOT be visible (demo is not a member)
  await expect(page.getByRole('heading', { name: 'Office Pantry', level: 2 })).not.toBeVisible();

  // 6. Click New list button reveals the form
  await page.getByRole('button', { name: 'New list' }).click();
  await expect(page.getByRole('textbox', { name: 'List name' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
});

test('lists overview: header, then creating a list from the bottom sheet shows its cover card', async ({ authenticatedPage: page }) => {
  await page.goto('/lists');

  await expect(page.getByRole('heading', { name: 'My lists', level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open account page' })).toBeVisible();

  const shoppingListName = 'e2e-cover-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
  await page.getByRole('button', { name: 'New list' }).click();
  await page.getByRole('textbox', { name: 'List name' }).fill(shoppingListName);
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  const card = page.getByTestId('list-card').filter({
    has: page.getByRole('heading', { name: shoppingListName, level: 2 }),
  });
  await expect(card).toBeVisible();
  await expect(card.getByRole('img', { name: `${shoppingListName} thumbnail` })).toBeVisible();
  await expect(page.getByRole('button', { name: 'New list' })).toBeVisible();

  await card.getByRole('link').click();
  await expect(page).toHaveURL(/\/lists\/[a-f0-9-]+$/);
});
