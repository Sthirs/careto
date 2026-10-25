import { expect, type Page } from '@playwright/test';

const TOKEN_KEY = 'careto.auth.token';

export class ShoppingListSettingsPage {
  // ShoppingListSettingsPanel.vue — the list-name input carries
  // data-testid="list-name-input"; Save sits in the bottom dock.
  private nameInput = this.page.getByTestId('list-name-input');
  private saveButton = this.page.getByRole('button', { name: 'Save' });
  private memberEmailInput = this.page.getByLabel('Add member');
  private addButton = this.page.getByRole('button', { name: 'Add', exact: true });

  // List image upload locators
  readonly imageEditButton = this.page.getByTestId('list-image-edit');
  readonly imageInput = this.page.getByTestId('list-image-input');
  readonly previewImage = this.page.getByTestId('list-image-preview');

  constructor(private page: Page) {}

  async rename(newName: string) {
    await this.nameInput.fill(newName);
    await this.saveButton.click();
  }

  async expectNameValue(value: string) {
    await expect(this.nameInput).toHaveValue(value);
  }

  async inviteByEmail(email: string) {
    await this.memberEmailInput.fill(email);
    await this.addButton.click();
  }

  async expectMemberVisible(displayName: string) {
    // list-settings/MemberList.vue — each member row shows the display name.
    await expect(this.page.getByText(displayName, { exact: true })).toBeVisible();
  }

  async expectMemberNotVisible(displayName: string) {
    // The invitee's displayName must not appear anywhere on the settings page
    // until they accept (name-hidden invariant).
    await expect(this.page.getByText(displayName, { exact: true })).not.toBeVisible();
  }

  async expectMemberEmailVisible(email: string) {
    await expect(this.page.getByText(email, { exact: true })).toBeVisible();
  }

  // list-settings/MemberList.vue — each member row (data-testid="list-member")
  // shows the display name and the email; the email is unique, so rows are
  // anchored on it.
  private memberRow(email: string) {
    return this.page
      .getByTestId('list-member')
      .filter({ has: this.page.getByText(email, { exact: true }) });
  }

  /** Clicks the row's "Remove … from the list" button (rendered for everyone but the current user). */
  async removeMember(email: string) {
    await this.memberRow(email).getByRole('button', { name: /^Remove .* from the list$/ }).click();
  }

  async expectMemberRowGone(email: string) {
    await expect(this.memberRow(email)).toHaveCount(0);
  }

  /** The member's avatar is their uploaded picture, not the initials fallback. */
  async expectMemberAvatarImage(email: string, imageUrl: string) {
    await expect(this.memberRow(email).locator('img')).toHaveAttribute('src', imageUrl);
  }

  // -- Pending invitation selectors (list-settings/MemberList.vue) --

  /**
   * Pending invitations follow the members in the same list, one
   * data-testid="pending-invitation" row each. A row renders "Invitation sent"
   * plus the invitee email only (no displayName, no avatar).
   */
  private pendingInvitationsSection() {
    return this.page.getByTestId('pending-invitation');
  }

  async expectPendingInvitationVisible(email: string) {
    await expect(this.pendingInvitationsSection().getByText(email, { exact: true })).toBeVisible();
  }

  async expectPendingInvitationNameHidden(displayName: string) {
    // The invitee's displayName must NOT appear in the pending rows
    // (email-only rendering per ADR-0011).
    await expect(
      this.pendingInvitationsSection().getByText(displayName, { exact: true }),
    ).not.toBeVisible();
  }

  /** Clicks the pending row's "Cancel invitation" button, as the inviter would. */
  async cancelInvitationViaUi(email: string) {
    await this.pendingInvitationsSection()
      .filter({ hasText: email })
      .getByRole('button', { name: `Cancel invitation to ${email}` })
      .click();
  }

  async expectPendingInvitationsSectionHidden() {
    await expect(this.pendingInvitationsSection()).toHaveCount(0);
  }

  /**
   * Cancel a pending invitation by invitee email via the API
   * (DELETE /lists/:shoppingListId/invitations/:invitationId). Reads the inviter's
   * bearer token from localStorage and the shoppingListId from the current settings
   * URL (/lists/:id/settings).
   */
  async cancelPendingInvitation(email: string) {
    const token = await this.page.evaluate((key: string) => localStorage.getItem(key), TOKEN_KEY);
    if (!token) {
      throw new Error('cancelPendingInvitation: no auth token in localStorage');
    }

    const match = this.page.url().match(/\/lists\/([^/]+)\/settings/);
    if (!match) {
      throw new Error(`cancelPendingInvitation: not on a settings page (url=${this.page.url()})`);
    }
    const shoppingListId = match[1];

    // GET /lists/:id to find the pending invitation id for this email.
    const shoppingListResponse = await this.page.request.get(`/api/lists/${shoppingListId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (shoppingListResponse.status() !== 200) {
      throw new Error(`cancelPendingInvitation: GET /lists/${shoppingListId} failed (${shoppingListResponse.status()})`);
    }
    const shoppingListJson = (await shoppingListResponse.json()) as {
      shoppingList: { pendingInvitations: Array<{ id: string; email: string }> };
    };
    const invitation = shoppingListJson.shoppingList.pendingInvitations.find((i) => i.email === email);
    if (!invitation) {
      throw new Error(`cancelPendingInvitation: no pending invitation for ${email}`);
    }

    const deleteResponse = await this.page.request.delete(
      `/api/lists/${shoppingListId}/invitations/${invitation.id}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (deleteResponse.status() !== 204) {
      throw new Error(`cancelPendingInvitation: DELETE failed (${deleteResponse.status()})`);
    }
  }
}
