import { expect, type Locator, type Page } from '@playwright/test';

// Endonyms shown by LanguageListbox.vue — never translated.
const LANGUAGE_NAMES = { en: 'English', it: 'Italiano' } as const;

export class AccountPage {
  readonly avatar: Locator;
  readonly nameInput: Locator;
  readonly emailInput: Locator;
  readonly saveButton: Locator;
  // The listbox trigger button; its text is the selected language's endonym.
  readonly languageButton: Locator;
  readonly avatarEditBadge: Locator;
  readonly avatarInput: Locator;
  readonly versionLine: Locator;

  constructor(private page: Page) {
    this.avatar = page.getByTestId('account-avatar');
    this.nameInput = page.locator('#account-name');
    this.emailInput = page.locator('#account-email');
    this.saveButton = page.getByTestId('account-save');
    this.languageButton = page.getByTestId('account-language');
    this.avatarEditBadge = page.getByTestId('account-avatar-edit');
    this.avatarInput = page.getByTestId('account-avatar-input');
    this.versionLine = page.getByTestId('account-version');
  }

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
