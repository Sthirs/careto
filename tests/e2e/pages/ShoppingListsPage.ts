import { expect, type Page } from '@playwright/test';

export class ShoppingListsPage {
  private createShoppingListButton = this.page.getByRole('button', { name: 'New list' });
  private shoppingListNameInput = this.page.getByRole('textbox', { name: 'List name' });
  private createButton = this.page.getByRole('button', { name: 'Save', exact: true });
  private cancelButton = this.page.getByRole('button', { name: 'Cancel' });

  constructor(private page: Page) {}

  async clickCreateShoppingListButton() {
    await this.createShoppingListButton.click();
  }

  async createShoppingList(name: string) {
    await this.clickCreateShoppingListButton();
    await this.shoppingListNameInput.fill(name);
    await this.createButton.click();
  }

  async openShoppingList(name: string) {
    // ShoppingListsView.vue:79-109 — list items are <li> with <h2>{{shoppingList.name}}</h2>.
    // Click navigates via router.push({ name: 'list-detail', params: { id: shoppingList.id } }).
    await this.page.getByRole('heading', { name, level: 2 }).click();
    await this.page.waitForURL(/\/lists\/[a-f0-9-]+$/);
  }

  async expectShoppingListVisible(name: string) {
    await expect(this.page.getByRole('heading', { name, level: 2 })).toBeVisible();
  }

  async expectShoppingListNotVisible(name: string) {
    await expect(this.page.getByRole('heading', { name, level: 2 })).not.toBeVisible();
  }

  async expectGradientThumbnail(name: string) {
    const shoppingListCard = this.page.getByTestId('list-card').filter({ has: this.page.getByRole('heading', { name, level: 2 }) });
    // The thumbnail is a gradient div (no <img>) when imageUrl is null
    await expect(shoppingListCard.locator('div[aria-label*="thumbnail"]')).toBeVisible();
    await expect(shoppingListCard.locator('img').first()).not.toBeVisible();
  }

  async expectMemberAvatars(name: string, count: number, overflowBadge?: string) {
    // ShoppingListsView.vue:292 — member avatars carry data-testid="member-avatar".
    const shoppingListCard = this.page.getByTestId('list-card').filter({ has: this.page.getByRole('heading', { name, level: 2 }) });
    const avatarDivs = shoppingListCard.getByTestId('member-avatar');
    await expect(avatarDivs.first()).toBeVisible();
    if (overflowBadge) {
      await expect(shoppingListCard.getByText(overflowBadge)).toBeVisible();
    }
  }

  async expectCreateShoppingListButton() {
    await expect(this.page.getByRole('button', { name: 'New list' })).toBeVisible();
  }

  // -- Invitation selectors (ShoppingListsView.vue:142-202) --

  /**
   * The invitation card is an <li> inside the Invitations <section>. Each card
   * contains an <h3> with the list name (ShoppingListsView.vue:169-174), a subtitle
   * "Invited by {inviterName}" (ShoppingListsView.vue:175-177), and Accept/Decline
   * buttons (ShoppingListsView.vue:182-197). The lists list uses <h2> (level 2) for
   * list names, so scoping to level-3 headings uniquely identifies invitation
   * cards.
   */
  private invitationCard(shoppingListName: string) {
    return this.page.locator('li', {
      has: this.page.getByRole('heading', { name: shoppingListName, level: 3 }),
    });
  }

  async expectInvitationVisible(shoppingListName: string, invitedByName: string) {
    const card = this.invitationCard(shoppingListName);
    await expect(card).toBeVisible();
    // ShoppingListsView.vue:175-177 — <p>Invited by {{ invitation.inviterName }}</p>
    await expect(card.getByText(`Invited by ${invitedByName}`, { exact: true })).toBeVisible();
  }

  async acceptInvitation(shoppingListName: string) {
    const card = this.invitationCard(shoppingListName);
    // ShoppingListsView.vue:182-189 — primary Accept button.
    await card.getByRole('button', { name: 'Accept' }).click();
  }

  async declineInvitation(shoppingListName: string) {
    const card = this.invitationCard(shoppingListName);
    // ShoppingListsView.vue:190-197 — outlined Decline button.
    await card.getByRole('button', { name: 'Decline' }).click();
  }

  async expectInvitationsSectionHidden() {
    // ShoppingListsView.vue:147-151 — <h2>Invitations</h2> only renders when
    // invitations.length > 0 (v-if on the <section>).
    await expect(this.page.getByRole('heading', { name: 'Invitations', level: 2 })).not.toBeVisible();
  }
}

// ---------------------------------------------------------------------------
// API-only invitation accept helper.
//
// Used by the migrated legacy specs (shoppingLists.spec.ts) so the
// seeded invitee (alice@careto.local / password123) accepts her own pending
// invitation via the API — no second browser context is needed. The helper
// logs the invitee in via POST /api/auth/login, lists her pending invitations
// via GET /api/lists, finds the one matching `shoppingListId`, and POSTs /accept.
// Uses global fetch (not page.request) so the API calls are fully decoupled
// from the inviter's browser context. A short retry loop guards against the
// race where the invite API call (triggered by the UI Add button) has not yet
// landed when this runs.
// ---------------------------------------------------------------------------

const ACCEPT_RETRY_ATTEMPTS = 10;
const ACCEPT_RETRY_DELAY_MS = 250;

type ShoppingListsApiResponse = {
  invitations: Array<{ id: string; shoppingListId: string }>;
};

export async function acceptInvitationViaApi(
  page: Page,
  shoppingListId: string,
  inviteeEmail: string,
  inviteePassword: string,
): Promise<void> {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173';

  // 1. Log the invitee in via the API (no second browser context).
  const loginResponse = await fetch(`${baseURL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: inviteeEmail, password: inviteePassword }),
  });
  if (loginResponse.status !== 200) {
    throw new Error(
      `acceptInvitationViaApi: login failed for ${inviteeEmail} (status ${loginResponse.status})`,
    );
  }
  const { token } = (await loginResponse.json()) as { token: string };

  // 2. GET /api/lists to find the pending invitation whose shoppingListId matches.
  //    Retry briefly — the invite POST (triggered by the UI Add button click)
  //    may still be in flight when this helper runs.
  let invitation: { id: string; shoppingListId: string } | undefined;
  for (let attempt = 0; attempt < ACCEPT_RETRY_ATTEMPTS; attempt++) {
    const shoppingListsResponse = await fetch(`${baseURL}/api/lists`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (shoppingListsResponse.status !== 200) {
      throw new Error(`acceptInvitationViaApi: GET /lists failed (status ${shoppingListsResponse.status})`);
    }
    const shoppingListsData = (await shoppingListsResponse.json()) as ShoppingListsApiResponse;
    invitation = shoppingListsData.invitations.find((i) => i.shoppingListId === shoppingListId);
    if (invitation) break;
    await page.waitForTimeout(ACCEPT_RETRY_DELAY_MS);
  }
  if (!invitation) {
    throw new Error(
      `acceptInvitationViaApi: no pending invitation for list ${shoppingListId} found for ${inviteeEmail}`,
    );
  }

  // 3. POST /api/lists/:shoppingListId/invitations/:invitationId/accept.
  const acceptResponse = await fetch(
    `${baseURL}/api/lists/${shoppingListId}/invitations/${invitation.id}/accept`,
    { method: 'POST', headers: { Authorization: `Bearer ${token}` } },
  );
  if (acceptResponse.status !== 200) {
    throw new Error(`acceptInvitationViaApi: accept failed (status ${acceptResponse.status})`);
  }
}
