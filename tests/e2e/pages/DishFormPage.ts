import { resolve } from 'node:path';

import { expect, type Page } from '@playwright/test';

/** DishFormPage — page object for the New dish and Dish screens (DishFormView). */
export class DishFormPage {
  constructor(private page: Page) {}

  nameField() {
    return this.page.getByRole('textbox', { name: 'Dish name' });
  }

  searchField() {
    return this.page.getByRole('textbox', { name: 'Search items to add' });
  }

  ingredientsList() {
    return this.page.getByRole('list', { name: 'Ingredients', exact: true });
  }

  searchResult(name: string) {
    return this.page.getByRole('list', { name: 'Matching items' }).getByRole('button', { name, exact: true });
  }

  saveButton() {
    return this.page.getByRole('button', { name: /^(Save dish|Save changes)$/ });
  }

  async fillName(name: string): Promise<void> {
    await this.nameField().fill(name);
  }

  async addIngredient(query: string, itemName: string): Promise<void> {
    await this.searchField().fill(query);
    await this.searchResult(`Add ${itemName}`).click();
  }

  async addCustomIngredient(text: string): Promise<void> {
    await this.searchField().fill(text);
    await this.searchResult(`Add ${text} as a custom item`).click();
  }

  async removeIngredient(name: string): Promise<void> {
    await this.page.getByRole('button', { name: `Remove ${name}`, exact: true }).click();
  }

  async ingredientNames(): Promise<string[]> {
    return (await this.ingredientsList().getByRole('listitem').allInnerTexts()).map((text) => text.trim());
  }

  /** The `d` of an ingredient's item icon, to compare with the list's. */
  async ingredientIconPath(name: string): Promise<string | null> {
    return this.ingredientsList()
      .getByRole('listitem')
      .filter({ hasText: name })
      .locator('svg path')
      .first()
      .getAttribute('d');
  }

  /** The `d` of a search result's item icon. */
  async searchResultIconPath(name: string): Promise<string | null> {
    return this.searchResult(name).locator('svg path').first().getAttribute('d');
  }

  async uploadPhoto(): Promise<void> {
    await this.page.getByTestId('dish-photo-input').setInputFiles(resolve('tests/e2e/fixtures/test-image.png'));
  }

  /** Saves and waits for the return to Dishes. */
  async save(): Promise<void> {
    await this.saveButton().click();
    await this.page.waitForURL(/\/dishes$/);
  }

  async cancel(): Promise<void> {
    await this.page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await this.page.waitForURL(/\/dishes$/);
  }

  async back(): Promise<void> {
    await this.page.getByRole('button', { name: 'Back to dishes' }).click();
    await this.page.waitForURL(/\/dishes$/);
  }

  pauseSheet() {
    return this.page.getByTestId('pause-sheet');
  }

  deleteSheet() {
    return this.page.getByTestId('delete-sheet');
  }

  /** Pauses for a preset, or until `date` (YYYY-MM-DD) with "Pick a date". */
  async pause(option: '1 week' | '2 weeks' | '1 month' | { date: string }): Promise<void> {
    await this.page.getByRole('button', { name: /^Pause this dish/ }).click();
    await expect(this.pauseSheet()).toBeVisible();
    if (typeof option === 'string') {
      await this.pauseSheet().getByRole('radio', { name: new RegExp(`^${option}`) }).click();
    } else {
      await this.pauseSheet().getByRole('radio', { name: /^Pick a date/ }).click();
      await this.pauseSheet().getByLabel('Paused until').fill(option.date);
    }
    await this.pauseSheet().getByRole('button', { name: 'Pause', exact: true }).click();
    await expect(this.pauseSheet()).toBeHidden();
  }

  async resume(): Promise<void> {
    await this.page.getByRole('button', { name: 'Resume', exact: true }).click();
  }

  async openDelete(): Promise<void> {
    await this.page.getByRole('button', { name: 'Delete dish', exact: true }).click();
    await expect(this.deleteSheet()).toBeVisible();
  }

  async keep(): Promise<void> {
    await this.deleteSheet().getByRole('button', { name: 'Keep it', exact: true }).click();
    await expect(this.deleteSheet()).toBeHidden();
  }

  async confirmDelete(): Promise<void> {
    await this.deleteSheet().getByRole('button', { name: 'Delete', exact: true }).click();
    await this.page.waitForURL(/\/dishes$/);
  }
}
