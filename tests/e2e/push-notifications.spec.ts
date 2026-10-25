/**
 * ADR-0020: device notifications via Web Push. Real FCM delivery is not
 * testable in CI, so the proof is split in two:
 *
 *  1. Grant the notifications permission, sign in, and observe the app
 *     actually registers a subscription (POST /api/push/subscriptions).
 *  2. Drive the installed service worker directly — via CDP's
 *     `ServiceWorker.deliverPushMessage`, which simulates a real push
 *     arriving at the browser — and assert the `push` handler shows the
 *     right notification. This tests our code deterministically and skips
 *     the part (real FCM delivery) we don't own.
 *
 * The `notificationclick` handler's *navigation* (focus an existing tab, or
 * `clients.openWindow()` a new one) cannot be asserted here: Chrome only
 * allows those calls off a trusted, user-activated click, and nothing an
 * automated test can dispatch — CDP's `deliverPushMessage`, or a manually
 * constructed `NotificationEvent` — carries that trust. Dispatching either
 * throws `InvalidAccessError: Not allowed to open/focus a window.`
 * (confirmed with a throwaway probe script while building this suite). The
 * routing *decision* (which client to focus, or which URL to open) is pure
 * and lives in src/lib/notificationRouting.ts, unit-tested in
 * apps/frontend/tests/notificationRouting.test.ts instead.
 *
 * A third spec below is a regression check for the sharpest edge in the
 * ADR-0020 design: switching to `injectManifest` (src/sw.ts) means the
 * `/api/` navigation denylist is no longer applied automatically by
 * `generateSW` — it had to be re-implemented by hand, and a regression
 * there would silently break OAuth sign-in.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { chromium, devices, expect, test as base, type Page } from '@playwright/test';
import { test as authTest } from './fixtures/auth';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173';

/**
 * A brand-new Playwright context has no `careto.app.buildId` in
 * localStorage. main.ts's ADR-0016 "new build detected" check treats that as
 * a mismatch on its very first run, unregisters the service worker it just
 * installed, and force-reloads — racing every `waitForEvent`/`waitForRequest`
 * listener below. Seeding the current build id before the first navigation
 * (real first-time visitors get this same reload once; it is orthogonal to
 * what this file is testing) makes the app skip that path entirely.
 */
async function currentBuildId(): Promise<string> {
  const res = await fetch(`${baseURL}/app-version.json`);
  const { buildId } = (await res.json()) as { buildId: string };
  return buildId;
}

const waitForNotificationCount = (page: Page) =>
  expect.poll(
    () =>
      page.evaluate(async () => {
        const registration = await navigator.serviceWorker.ready;
        return (await registration.getNotifications()).length;
      }),
    { timeout: 10_000 },
  );

type PushPayload = { title: string; body: string; url?: string };

/**
 * Chrome deliberately disables the Push API in "incognito" contexts
 * (https://crbug.com/41124656 — "there is deliberately no way to
 * feature-detect this"), and Playwright's regular `browser.newContext()` IS
 * one, headless or not. A real on-disk profile via `launchPersistentContext`
 * is the only way to exercise `PushManager.subscribe()` end-to-end, so the
 * three tests below get a dedicated fixture instead of the shared
 * `authenticatedPage` (which is a regular, incognito-equivalent context).
 */
const test = base.extend<{ pushPage: Page; deliverPush: (payload: PushPayload) => Promise<void> }>({
  pushPage: async ({}, use) => {
    const userDataDir = mkdtempSync(join(tmpdir(), 'careto-push-'));
    const context = await chromium.launchPersistentContext(userDataDir, {
      ...devices['Desktop Chrome'],
      // Mirrors playwright.config.ts's chromium project: the default headless
      // Chromium binary (headless_shell) does not honor
      // --unsafely-treat-insecure-origin-as-secure below, so navigator.
      // serviceWorker / Notification stay unavailable without this channel.
      channel: 'chromium',
      args: [`--unsafely-treat-insecure-origin-as-secure=${baseURL}`],
    });
    await context.grantPermissions(['notifications'], { origin: baseURL });

    const loginRes = await fetch(`${baseURL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'demo@careto.local', password: 'password123' }),
    });
    const { token } = (await loginRes.json()) as { token: string };
    const buildId = await currentBuildId();

    await context.addInitScript(
      ({ token, buildId }) => {
        window.localStorage.setItem('careto.auth.token', token);
        window.localStorage.setItem('careto.app.buildId', buildId);
      },
      { token, buildId },
    );

    const page = context.pages()[0] ?? (await context.newPage());
    await use(page);
    await context.close();
    rmSync(userDataDir, { recursive: true, force: true });
  },

  // Delivers a push message via the DevTools protocol instead of dispatching
  // a synthetic PushEvent at the worker: a manually constructed PushEvent
  // reliably produces zero notifications (event.waitUntil()'s lifecycle
  // extension does not attach to it), even though sw.ts's `push` handler is
  // correct — CDP's ServiceWorker.deliverPushMessage is what the Chrome
  // DevTools "Push" button itself uses, and is what actually exercises the
  // handler the way a real push service would.
  deliverPush: async ({ pushPage }, use) => {
    const context = pushPage.context();
    const cdp = await context.newCDPSession(pushPage);
    await cdp.send('ServiceWorker.enable');

    let registrationId: string | undefined;
    cdp.on('ServiceWorker.workerRegistrationUpdated', (params) => {
      const registration = params.registrations.find(
        (candidate) => candidate.scopeURL === `${baseURL}/`,
      );
      if (registration) registrationId = registration.registrationId;
    });

    await use(async (payload) => {
      // deliverPushMessage silently no-ops against a registration that
      // hasn't finished activating yet — waiting for `.ready` (which only
      // resolves once a worker is active and controlling the page) avoids a
      // race against the CDP registrationId capture above.
      await pushPage.evaluate(() => navigator.serviceWorker.ready);
      await expect.poll(() => registrationId, { timeout: 10_000 }).toBeTruthy();

      // Roughly 1 delivery in 10, Chromium drops the notification: the
      // worker's `push` handler runs and `showNotification()` resolves, yet
      // `getNotifications()` never reports it (observed by instrumenting the
      // worker — the count stays at 0, it is never shown and then closed).
      // A redelivery has always recovered it, and is harmless otherwise:
      // sw.ts tags notifications by URL, so a repeat replaces rather than
      // duplicates.
      const notificationCount = () =>
        pushPage.evaluate(async () => {
          const registration = await navigator.serviceWorker.ready;
          return (await registration.getNotifications()).length;
        });

      for (let attempt = 1; attempt <= 3; attempt += 1) {
        await cdp.send('ServiceWorker.deliverPushMessage', {
          origin: baseURL,
          registrationId: registrationId as string,
          data: JSON.stringify(payload),
        });
        const deadline = Date.now() + 2_000;
        while (Date.now() < deadline) {
          if ((await notificationCount()) > 0) return;
          await pushPage.waitForTimeout(200);
        }
      }
    });
  },
});

test.describe('Push notifications (ADR-0020)', () => {
  test('registers a push subscription when notification permission is granted', async ({
    pushPage: page,
  }) => {
    const subscriptionRequest = page.waitForRequest(
      (request) =>
        request.url().includes('/api/push/subscriptions') && request.method() === 'POST',
    );

    await page.goto('/lists');

    const request = await subscriptionRequest;
    const body = request.postDataJSON() as {
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
    };

    expect(body.endpoint).toMatch(/^https:\/\//);
    expect(body.keys?.p256dh).toBeTruthy();
    expect(body.keys?.auth).toBeTruthy();

    // The response matters as much as the request here: the backend allowlists
    // `endpoint` against the known push-service origins (see
    // apps/backend/src/services/push/endpointValidation.ts), so this asserts
    // that an endpoint a *real* browser mints is actually accepted — the one
    // thing the unit tests around that allowlist cannot prove.
    const response = await request.response();
    expect(response?.status()).toBe(201);
  });

  test('delivers a push message to the service worker and shows a notification', async ({
    pushPage: page,
    deliverPush,
  }) => {
    await page.goto('/lists');

    await deliverPush({
      title: 'List invitation',
      body: 'Alice invited you to join "Mercà de Rialto"',
      url: '/lists/e2e-fake-id',
    });

    await waitForNotificationCount(page).toBeGreaterThan(0);

    const notification = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      const [current] = await registration.getNotifications();
      return { title: current.title, body: current.body, url: (current.data as { url?: string })?.url };
    });

    expect(notification.title).toBe('List invitation');
    expect(notification.body).toContain('Mercà de Rialto');
    expect(notification.url).toBe('/lists/e2e-fake-id');
  });

  test('clicking a notification dismisses it', async ({ pushPage: page, deliverPush }) => {
    const [worker] = await Promise.all([
      page.context().waitForEvent('serviceworker'),
      page.goto('/lists'),
    ]);

    await deliverPush({ title: 'List invitation', body: 'New invitation', url: '/lists/e2e-fake-id' });
    await waitForNotificationCount(page).toBeGreaterThan(0);

    // clients.openWindow()/WindowClient.focus() — the two things sw.ts's
    // notificationclick handler can do after this — both require a trusted,
    // user-activated event, which a synthetic dispatch never carries. They
    // are expected to throw here; what this asserts is the part that is
    // observable without one: the handler runs, and closes the notification
    // it was invoked for. See the file header comment for the routing logic
    // this deliberately doesn't cover.
    await worker.evaluate(async () => {
      const [notification] = await self.registration.getNotifications();
      self.dispatchEvent(new NotificationEvent('notificationclick', { notification }));
    });

    await waitForNotificationCount(page).toBe(0);
  });
});

authTest.describe('Push service worker regression', () => {
  authTest('GET /api/auth/oauth still reaches the backend under the injectManifest worker', async ({
    page,
  }) => {
    // Unauthenticated on purpose: /login is the page a signed-out visitor
    // lands on, and is where the service worker for '/' first installs.
    const buildId = await currentBuildId();
    await page.context().addInitScript((id: string) => {
      window.localStorage.setItem('careto.app.buildId', id);
    }, buildId);
    await page.goto('/login');
    await page.evaluate(() => navigator.serviceWorker.ready);

    // A real top-level navigation, exactly like clicking the "Sign in with
    // Dex" link (tests/e2e/auth/dex-login.spec.ts). If sw.ts's `/api/`
    // navigation denylist regressed, the worker would serve the cached
    // index.html here instead of letting this reach the backend redirect.
    await page.goto('/api/auth/oauth');

    await page.waitForURL(/\/dex\//, { timeout: 15_000 });
  });
});
