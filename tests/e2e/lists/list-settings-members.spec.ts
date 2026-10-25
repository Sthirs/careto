// List settings flows that had no coverage at any level: removing a member and
// cancelling a pending invitation from the settings panel (the buttons in
// ShoppingListSettingsPanel.vue), and a member's profile picture being shown to the
// other members of their list (docs/specifications.md §Features: "A member's
// profile picture, when set, is shown to other members of their lists").
//
// Lists are built over the API with fresh users so the shared demo user's
// lists list is never touched.
import { expect, test } from '../fixtures/auth';
import {
  createShoppingListViaApi,
  inviteViaApi,
  registerNamedUser,
  uploadAvatarViaApi,
} from '../fixtures/lists';
import { ShoppingListSettingsPage, ShoppingListsPage } from '../pages';

test('remove a member from the settings panel: they leave the list and lose access to the list', async ({
  pageForUser,
}) => {
  const owner = await registerNamedUser('Olga');
  const member = await registerNamedUser('Mira');
  const shoppingList = await createShoppingListViaApi(owner, [member], 'e2e-remove');

  const ownerPage = await pageForUser(owner.email, owner.password);
  const settingsPage = new ShoppingListSettingsPage(ownerPage);
  await ownerPage.goto(`/lists/${shoppingList.id}/settings`);
  await settingsPage.expectMemberVisible(member.displayName);

  await settingsPage.removeMember(member.email);

  await settingsPage.expectMemberRowGone(member.email);
  await ownerPage.reload();
  await settingsPage.expectMemberRowGone(member.email);

  // The removed member no longer sees the list, and a deep link is refused.
  const memberPage = await pageForUser(member.email, member.password);
  await memberPage.goto('/lists');
  await new ShoppingListsPage(memberPage).expectShoppingListNotVisible(shoppingList.name);
  await memberPage.goto(`/lists/${shoppingList.id}`);
  await expect(memberPage.getByText('We could not load this list.')).toBeVisible();
});

test('cancel a pending invitation from the settings panel: it disappears for inviter and invitee', async ({
  pageForUser,
}) => {
  const owner = await registerNamedUser('Olga');
  const invitee = await registerNamedUser('Ivan');
  const shoppingList = await createShoppingListViaApi(owner, [], 'e2e-cancel-invite');
  await inviteViaApi(owner, shoppingList.id, invitee.email);

  // The invitee can see the invitation before it is cancelled.
  const inviteePage = await pageForUser(invitee.email, invitee.password);
  const inviteeShoppingListsPage = new ShoppingListsPage(inviteePage);
  await inviteePage.goto('/lists');
  await inviteeShoppingListsPage.expectInvitationVisible(shoppingList.name, owner.displayName);

  const ownerPage = await pageForUser(owner.email, owner.password);
  const settingsPage = new ShoppingListSettingsPage(ownerPage);
  await ownerPage.goto(`/lists/${shoppingList.id}/settings`);
  await settingsPage.expectPendingInvitationVisible(invitee.email);

  await settingsPage.cancelInvitationViaUi(invitee.email);

  await settingsPage.expectPendingInvitationsSectionHidden();
  await ownerPage.reload();
  await settingsPage.expectPendingInvitationsSectionHidden();

  await inviteePage.reload();
  await inviteeShoppingListsPage.expectInvitationsSectionHidden();
  await inviteeShoppingListsPage.expectShoppingListNotVisible(shoppingList.name);
});

test("another member's profile picture is shown in the member list", async ({
  pageForUser,
}) => {
  const owner = await registerNamedUser('Olga');
  const member = await registerNamedUser('Pia');
  const shoppingList = await createShoppingListViaApi(owner, [member], 'e2e-member-avatar');
  const memberImageUrl = await uploadAvatarViaApi(member);

  const ownerPage = await pageForUser(owner.email, owner.password);

  await ownerPage.goto(`/lists/${shoppingList.id}/settings`);
  await new ShoppingListSettingsPage(ownerPage).expectMemberAvatarImage(member.email, memberImageUrl);
});
