import { type Page } from '@playwright/test';

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * StoreSectionsPage — page object for /lists/:id/settings/sections
 * (StoreSectionsView.vue, ADR-0026).
 */
export class StoreSectionsPage {
  constructor(private page: Page) {}

  list() {
    return this.page.getByRole('list', { name: 'Store sections in shopping order' });
  }

  /** The section keys, top to bottom (`data-section-key` on each row). */
  async sectionKeys(): Promise<string[]> {
    return this.list()
      .getByTestId('store-section')
      .evaluateAll((rows) => rows.map((row) => row.getAttribute('data-section-key') ?? ''));
  }

  grip(sectionName: string) {
    return this.list().getByRole('button', { name: new RegExp(`^Move ${escapeRegExp(sectionName)},`) });
  }

  async moveUpWithKeyboard(sectionName: string, times = 1): Promise<void> {
    for (let step = 0; step < times; step += 1) {
      await this.grip(sectionName).press('ArrowUp');
    }
  }

  /** Drags a section's grip onto the top half of another section's row. */
  async dragAbove(sectionName: string, targetName: string): Promise<void> {
    await this.grip(sectionName).scrollIntoViewIfNeeded();
    const from = await this.grip(sectionName).boundingBox();
    const to = await this.list().getByTestId('store-section').filter({ hasText: targetName }).boundingBox();
    if (!from || !to) throw new Error('dragAbove: rows not visible');
    await this.page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await this.page.mouse.down();
    await this.page.mouse.move(to.x + to.width / 2, to.y + 4, { steps: 8 });
    await this.page.mouse.up();
  }

  async save(): Promise<void> {
    await this.page.getByRole('button', { name: 'Save order' }).click();
    await this.page.waitForURL(/\/lists\/[^/]+\/settings$/, { timeout: 10000 });
  }
}
