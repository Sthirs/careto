// This is the ONLY spec that drives the UI login path. All other specs use the authenticatedPage fixture from ../fixtures/auth.
import { test, expect } from '@playwright/test';
import { seedBuildId } from '../fixtures/auth';

test('UI login with demo user works', async ({ page }) => {
  // Without this, main.ts's ADR-0016 "new build detected" check fires a
  // purge-and-reload on this page's very first navigation (see seedBuildId's
  // doc comment in ../fixtures/auth), racing the login steps below.
  await seedBuildId(page);
  await page.goto('/login');

  // Email field is prefilled with the demo user (LoginView.vue:11-14 reactive form).
  const emailInput = page.getByLabel('Email');
  await expect(emailInput).toHaveValue('demo@careto.local');

  // Password field is prefilled with password123 (LoginView.vue:11-14).
  const passwordInput = page.getByLabel('Password', { exact: true });
  await expect(passwordInput).toHaveValue('password123');

  // Log in button (LoginView.vue).
  await page.getByRole('button', { name: 'Log in' }).click();

  // Auth guard redirects authenticated users to /lists.
  await page.waitForURL(/\/lists$/);
  await expect(page).toHaveURL(/\/lists$/);

  // ShoppingListsView sets the page title to "Careto" (ShoppingListsView.vue:72-74).
  await expect(page.getByRole('heading', { name: 'Careto' })).toBeVisible();
});
