import { expect, type Locator, type Page } from '@playwright/test';

export class LoginPage {
  private readonly emailField: Locator;
  private readonly passwordField: Locator;
  private readonly signInButton: Locator;

  constructor(private page: Page) {
    this.emailField = page.getByLabel('Email');
    this.passwordField = page.getByLabel('Password', { exact: true });
    this.signInButton = page.getByRole('button', { name: 'Sign in' });
  }

  async login(email: string, password: string) {
    await this.emailField.fill(email);
    await this.passwordField.fill(password);
    await this.signInButton.click();
  }

  async expectRedirectedToShoppingLists() {
    await expect(this.page).toHaveURL(/\/lists$/);
  }
}
