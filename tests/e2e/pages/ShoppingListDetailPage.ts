import { type Page } from '@playwright/test';

/**
 * ShoppingListDetailPage — page object for /lists/:id (ShoppingListDetailView).
 */
export class ShoppingListDetailPage {
  constructor(private page: Page) {}

  // ListSectionsNav.vue: the bottom "List sections" tab bar shared by every
  // section of a list.
  sectionsNav() {
    return this.page.getByRole('navigation', { name: 'List sections' });
  }

  async openSection(label: 'List' | 'Dishes' | 'Week' | 'Settings'): Promise<void> {
    await this.sectionsNav().getByRole('link', { name: label, exact: true }).click();
  }

  async openSettings(): Promise<void> {
    await this.openSection('Settings');
    await this.page.waitForURL(/\/lists\/[^/]+\/settings$/, { timeout: 10000 });
  }

  // Every list section's header back arrow (aria-label "Back to lists") goes
  // to My lists via goBackTo (lib/backNavigation.ts, ADR-0019 / ADR-0022).
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
