import { type Page } from '@playwright/test';

/**
 * ShoppingListDetailPage — page object for /lists/:id (ShoppingListDetailView).
 */
export class ShoppingListDetailPage {
  constructor(private page: Page) {}

  // TopbarSettingsButtons.vue renders a text "Settings" button on wide
  // viewports and an icon-only "Toggle settings" button on narrow ones; only
  // one of them is visible at a time.
  async openSettings(): Promise<void> {
    await this.page
      .getByRole('button', { name: /^(Settings|Toggle settings)$/ })
      .filter({ visible: true })
      .click();
    await this.page.waitForURL(/\/lists\/[^/]+\/settings$/, { timeout: 10000 });
  }

  // ShoppingListSettingsView.vue's topbar back arrow (aria-label "Back to
  // list"), wired to `goBackTo` (lib/backNavigation.ts, ADR-0019): it pops the
  // browser history entry when the previous one already is list-detail.
  async clickBackToShoppingList(): Promise<void> {
    await this.page.getByRole('button', { name: 'Back to list' }).click();
    await this.page.waitForURL(/\/lists\/[^/]+$/, { timeout: 10000 });
  }

  // ShoppingListDetailView.vue's own topbar back arrow (aria-label "Back to
  // lists", plural — distinct from the singular "Back to list" used by the
  // nested settings page above), wired the same way via goBackTo (ADR-0019).
  async clickBackToShoppingLists(): Promise<void> {
    await this.page.getByRole('button', { name: 'Back to lists' }).click();
    await this.page.waitForURL(/\/lists$/, { timeout: 10000 });
  }

  async getShoppingListId(): Promise<string> {
    // Use the URL's pathname, not a naive split('/').pop() — a trailing
    // ?overlay=<id> query (useRoutedOverlay, ADR-0019) would otherwise be
    // captured as part of the id.
    const id = new URL(this.page.url()).pathname.split('/').pop();
    if (!id) {
      throw new Error(`getShoppingListId: no id segment in URL ${this.page.url()}`);
    }
    return id;
  }
}
