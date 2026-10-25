import { test, expect } from '../fixtures/auth';
import { AccountPage } from '../pages/AccountPage';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173';
const TOKEN_KEY = 'careto.auth.token';
const ORIGINAL_NAME = 'Demo User';
const ORIGINAL_LANGUAGE = 'en';

/**
 * Restore the demo user's display name via the API so sibling suites
 * (lists, settings) that rely on 'Demo User' are not polluted.
 */
async function restoreDemoName(page: import('@playwright/test').Page) {
  const token = await page.evaluate((key: string) => localStorage.getItem(key), TOKEN_KEY);
  if (!token) return;

  await fetch(`${baseURL}/api/auth/me`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ displayName: ORIGINAL_NAME, language: ORIGINAL_LANGUAGE }),
  });
}

test.afterEach(async ({ authenticatedPage: page }) => {
  await restoreDemoName(page);
});

test.afterAll(async () => {
  // Defensive: re-login and PATCH to guarantee the demo name is restored even
  // if afterEach was skipped (e.g. fixture teardown failure).
  const response = await fetch(`${baseURL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'demo@careto.local', password: 'password123' }),
  });
  if (response.status !== 200) return;
  const data = (await response.json()) as { token: string };
  if (typeof data.token !== 'string') return;

  await fetch(`${baseURL}/api/auth/me`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${data.token}`,
    },
    body: JSON.stringify({ displayName: ORIGINAL_NAME, language: ORIGINAL_LANGUAGE }),
  });
});

test('account page: initials avatar, read-only email, rename persists', async ({
  authenticatedPage: page,
}) => {
  const account = new AccountPage(page);
  await page.goto('/account');

  // Screen header
  await expect(page.getByRole('heading', { name: 'Account', level: 1 })).toBeVisible();

  // Initial state — demo user "Demo User"
  await expect(account.avatar).toHaveText('D');
  await expect(account.nameInput).toHaveValue('Demo User');
  await expect(account.emailInput).toHaveValue('demo@careto.local');
  await expect(account.emailInput).not.toBeEditable();
  await expect(page.getByText('Managed by your sign-in provider')).toBeVisible();

  await account.nameInput.fill('Zoe Example');
  await expect(account.avatar).toHaveText('Z');

  const saved = page.waitForResponse(
    (r) => r.url().includes('/api/auth/me') && r.request().method() === 'PATCH',
  );
  await account.saveButton.click();
  expect((await saved).status()).toBe(200);
  await expect(account.saveButton).toBeDisabled();

  await page.reload();
  await expect(account.nameInput).toHaveValue('Zoe Example');
});
