import { dispatchNotification } from './pushDispatch';

export type InvitationNotificationInput = {
  shoppingListId: string;
  shoppingListName: string;
  inviterName: string;
  inviteeUserId: string;
};

/**
 * Notifies a single invitee. Only call this when `inviteeId` resolved to a
 * real user — `invitationService.createInvitation` leaves it `null` when
 * the invitee has no account yet, and there is nothing to subscribe to in
 * that case.
 */
export const notifyShoppingListInvitation = async (
  input: InvitationNotificationInput,
): Promise<void> => {
  await dispatchNotification([input.inviteeUserId], 'invitation.created', {
    actorName: input.inviterName,
    shoppingListName: input.shoppingListName,
    url: `/lists/${input.shoppingListId}`,
  });
};
