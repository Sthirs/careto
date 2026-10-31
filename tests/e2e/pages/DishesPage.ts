import { expect, type Page } from '@playwright/test';

/**
 * DishesPage — page object for /lists/:id/dishes (DishesView). Cards are
 * found by their accessible controls: the ⋮ link "Edit <name>" and the
 * top-right button (+, ✓ or ▶), named after its action.
 */
export class DishesPage {
  constructor(private page: Page) {}

  async goto(shoppingListId: string): Promise<void> {
    await this.page.goto(`/lists/${shoppingListId}/dishes`);
    await expect(this.page.getByRole('heading', { name: 'Dishes', level: 1 })).toBeVisible();
  }

  inListSection() {
    return this.page.getByTestId('dishes-in-list');
  }

  suggestedSection() {
    return this.page.getByTestId('dishes-suggested');
  }

  pausedSection() {
    return this.page.getByTestId('paused-dishes');
  }

  /** Dish names shown in a section, in order. */
  async names(section: ReturnType<DishesPage['inListSection']>): Promise<string[]> {
    return section.getByTestId('dish-card').evaluateAll((cards) =>
      cards.map((card) => card.getAttribute('data-dish-name') ?? ''),
    );
  }

  card(name: string) {
    return this.page.locator(`[data-testid="dish-card"][data-dish-name="${name}"]`);
  }

  /**
   * The card moves before the server answers; wait for the dish's list write
   * so a next action is not sent while it is still in flight.
   */
  private listWritten(method: 'POST' | 'DELETE') {
    return this.page.waitForResponse(
      (response) =>
        response.request().method() === method &&
        /\/api\/lists\/[^/]+\/dishes\/[^/]+\/list$/.test(new URL(response.url()).pathname) &&
        response.ok(),
    );
  }

  async addToList(name: string): Promise<void> {
    const saved = this.listWritten('POST');
    await this.page.getByRole('button', { name: `Add ${name} to the list`, exact: true }).click();
    await saved;
  }

  async undo(name: string): Promise<void> {
    const saved = this.listWritten('DELETE');
    await this.page
      .getByRole('button', { name: `${name} is in the list. Tap to remove its ingredients`, exact: true })
      .click();
    await saved;
  }

  async resume(name: string): Promise<void> {
    await this.page.getByRole('button', { name: `Resume ${name}`, exact: true }).click();
  }

  async openEdit(name: string): Promise<void> {
    await this.page.getByRole('link', { name: `Edit ${name}`, exact: true }).click();
    await this.page.waitForURL(/\/dishes\/[0-9a-f-]{36}$/);
  }

  async newDish(): Promise<void> {
    await this.page.getByRole('link', { name: 'New dish', exact: true }).click();
    await this.page.waitForURL(/\/dishes\/new$/);
  }

  async back(): Promise<void> {
    await this.page.getByRole('button', { name: 'Back to lists' }).click();
    await this.page.waitForURL(/\/lists$/);
  }

  async openListTab(): Promise<void> {
    await this.page.getByRole('navigation', { name: 'List sections' }).getByRole('link', { name: 'List', exact: true }).click();
    await this.page.waitForURL(/\/lists\/[0-9a-f-]{36}$/);
  }
}
