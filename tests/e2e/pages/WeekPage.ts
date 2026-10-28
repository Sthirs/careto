import { expect, type Page } from '@playwright/test';

/**
 * WeekPage — page object for /lists/:id/week (WeekView). Slots are found by
 * their "Monday dinner"-style name; the dish picker and the New plan
 * confirmation are bottom sheets (dialogs).
 */
export class WeekPage {
  constructor(private page: Page) {}

  async goto(shoppingListId: string): Promise<void> {
    await this.page.goto(`/lists/${shoppingListId}/week`);
    await expect(this.page.getByRole('heading', { name: 'Week', level: 1 })).toBeVisible();
  }

  slot(name: string) {
    return this.page.locator(`[data-testid="week-slot"][data-slot="${name}"]`);
  }

  /** The dish planned in a slot, or null when it is empty. */
  async dishIn(name: string): Promise<string | null> {
    return this.slot(name).getAttribute('data-dish-name');
  }

  plannedCount() {
    return this.page.getByTestId('week-planned-count');
  }

  picker() {
    return this.page.getByTestId('week-picker');
  }

  async openSlot(name: string): Promise<void> {
    await this.page.getByRole('button', { name: new RegExp(`^(Add a dish for ${name}|${name}: .*\\. Change dish)$`) }).click();
    await expect(this.picker()).toBeVisible();
  }

  async searchDish(query: string): Promise<void> {
    await this.picker().getByRole('textbox', { name: 'Search dishes' }).fill(query);
  }

  choice(dishName: string) {
    return this.picker().locator(`[data-testid="week-choice"][data-dish-name="${dishName}"]`);
  }

  async choose(dishName: string): Promise<void> {
    await this.choice(dishName).click();
    await expect(this.picker()).toBeHidden();
  }

  async removeFromPicker(): Promise<void> {
    await this.picker().getByRole('button', { name: 'Remove from this slot' }).click();
    await expect(this.picker()).toBeHidden();
  }

  async remove(dishName: string, slotName: string): Promise<void> {
    await this.page.getByRole('button', { name: `Remove ${dishName} from ${slotName}`, exact: true }).click();
  }

  toast() {
    return this.page.getByTestId('undo-toast');
  }

  async undo(): Promise<void> {
    await this.toast().getByRole('button', { name: 'Undo' }).click();
  }

  async startNewPlan(): Promise<void> {
    await this.page.getByRole('button', { name: 'New plan', exact: true }).click();
    const sheet = this.page.getByTestId('new-plan-sheet');
    await expect(sheet).toBeVisible();
    await sheet.getByRole('button', { name: 'Clear all' }).click();
    await expect(sheet).toBeHidden();
  }

  addButton() {
    return this.page.getByTestId('add-plan-to-list');
  }

  async addToList(): Promise<void> {
    await this.addButton().click();
  }

  async openListTab(): Promise<void> {
    await this.page.getByRole('navigation', { name: 'List sections' }).getByRole('link', { name: 'List', exact: true }).click();
    await this.page.waitForURL(/\/lists\/[0-9a-f-]{36}$/);
  }
}
