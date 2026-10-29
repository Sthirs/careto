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

  // ItemSearchField.vue: the "I need…" field in the bottom dock.
  searchField() {
    return this.page.getByRole('textbox', { name: 'Search or add an item' });
  }

  async search(query: string): Promise<void> {
    await this.searchField().fill(query);
  }

  // ItemSearchResults.vue: each result is a button named by its action.
  searchResult(name: string) {
    return this.page.getByRole('list', { name: 'Matching items' }).getByRole('button', { name, exact: true });
  }

  async addFromSearch(query: string, itemName: string): Promise<void> {
    await this.search(query);
    await this.searchResult(`Add ${itemName}`).click();
  }

  async addCustomItem(name: string): Promise<void> {
    await this.search(name);
    await this.searchResult(`Add ${name} as a custom item`).click();
  }

  toBuyList() {
    return this.page.getByRole('list', { name: 'To buy' });
  }

  lastUsedList() {
    return this.page.getByRole('list', { name: 'Last used' });
  }

  /** Names of the tiles in a list, top to bottom. */
  async tileNames(list: ReturnType<ShoppingListDetailPage['toBuyList']>): Promise<string[]> {
    return (await list.getByTestId('list-item').allInnerTexts()).map((text) => text.trim());
  }

  async markBought(itemName: string): Promise<void> {
    await this.toBuyList().getByRole('button', { name: `Mark ${itemName} as bought` }).click();
  }

  async addBack(itemName: string): Promise<void> {
    await this.lastUsedList().getByRole('button', { name: `Add ${itemName} back to the list` }).click();
  }

  /** ListItemTile.vue: a left swipe past the threshold removes the item. */
  async swipeRemove(itemName: string): Promise<void> {
    const tile = this.toBuyList().getByTestId('list-item').filter({ hasText: itemName });
    const box = await tile.boundingBox();
    if (!box) throw new Error(`swipeRemove: no tile for ${itemName}`);
    const y = box.y + box.height / 2;
    await this.page.mouse.move(box.x + box.width - 10, y);
    await this.page.mouse.down();
    await this.page.mouse.move(box.x + box.width / 2, y, { steps: 5 });
    await this.page.mouse.move(box.x + 10, y, { steps: 5 });
    await this.page.mouse.up();
  }

  // ItemMenuSheet.vue: the ⋮ sheet of a to-buy tile (ADR-0026).
  itemMenu() {
    return this.page.getByRole('dialog');
  }

  async openItemMenu(itemName: string): Promise<void> {
    await this.toBuyList().getByRole('button', { name: `More options for ${itemName}` }).click();
    await this.itemMenu().waitFor();
  }

  /**
   * The list updates before the server answers; wait for the item write so a
   * reload right after sees it.
   */
  private itemWritten(method: 'PATCH' | 'DELETE') {
    return this.page.waitForResponse(
      (response) =>
        response.request().method() === method &&
        /\/api\/lists\/[^/]+\/items\/[^/]+$/.test(new URL(response.url()).pathname) &&
        response.ok(),
    );
  }

  async removeViaMenu(itemName: string): Promise<void> {
    await this.openItemMenu(itemName);
    const removed = this.itemWritten('DELETE');
    await this.itemMenu().getByRole('button', { name: 'Remove from list' }).click();
    await removed;
  }

  async changeIcon(itemName: string, iconSearch: string, iconLabel: string): Promise<void> {
    await this.openItemMenu(itemName);
    await this.itemMenu().getByRole('button', { name: 'Change icon' }).click();
    await this.itemMenu().getByRole('textbox', { name: 'Search icons' }).fill(iconSearch);
    await this.itemMenu().getByTitle(iconLabel, { exact: true }).click();
    const saved = this.itemWritten('PATCH');
    await this.itemMenu().getByRole('button', { name: 'Save icon' }).click();
    await saved;
    await this.closeItemMenuFromActions();
  }

  async changeSection(itemName: string, sectionLabel: string): Promise<void> {
    await this.openItemMenu(itemName);
    await this.itemMenu().getByRole('button', { name: /^Store section/ }).click();
    await this.itemMenu().getByRole('radio', { name: sectionLabel }).click();
    const saved = this.itemWritten('PATCH');
    await this.itemMenu().getByRole('button', { name: 'Save section' }).click();
    await saved;
    await this.closeItemMenuFromActions();
  }

  /** Saving goes back to the item's actions; Escape then closes the sheet. */
  private async closeItemMenuFromActions(): Promise<void> {
    await this.itemMenu().getByRole('button', { name: 'Remove from list' }).waitFor();
    await this.page.keyboard.press('Escape');
    await this.itemMenu().waitFor({ state: 'hidden' });
  }

  /** The `d` of a tile's item icon, to compare icons before and after. */
  async tileIconPath(itemName: string): Promise<string | null> {
    return this.toBuyList()
      .getByTestId('list-item')
      .filter({ hasText: itemName })
      .getByRole('button', { name: `Mark ${itemName} as bought` })
      .locator('svg path')
      .first()
      .getAttribute('d');
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
