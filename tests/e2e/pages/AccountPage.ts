import { expect, type Page } from '@playwright/test';

// Endonyms shown by LanguageListbox.vue — never translated.
const LANGUAGE_NAMES = { en: 'English', it: 'Italiano' } as const;

export class AccountPage {
  readonly avatar = this.page.getByTestId('account-avatar');
  readonly nameInput = this.page.locator('#account-name');
  readonly emailInput = this.page.locator('#account-email');
  readonly saveButton = this.page.getByTestId('account-save');
  // The listbox trigger button; its text is the selected language's endonym.
  readonly languageButton = this.page.getByTestId('account-language');
  readonly avatarEditBadge = this.page.getByTestId('account-avatar-edit');
  readonly avatarInput = this.page.getByTestId('account-avatar-input');
  readonly versionLine = this.page.getByTestId('account-version');

  constructor(private page: Page) {}

  /** Pick the interface language in the listbox; it only persists on Save. */
  async selectLanguage(locale: 'en' | 'it') {
    await this.languageButton.click();
    await this.page.getByRole('option', { name: LANGUAGE_NAMES[locale] }).click();
    await expect(this.page.getByRole('listbox')).toHaveCount(0);
  }

  async expectLanguage(locale: 'en' | 'it') {
    await expect(this.languageButton).toContainText(LANGUAGE_NAMES[locale]);
  }
}
