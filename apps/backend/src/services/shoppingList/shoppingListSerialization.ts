import { ShoppingList } from '../../entities/ShoppingList';
import { Invitation } from '../../entities/Invitation';

export type SerializedShoppingList = {
  id: string;
  name: string;
  imageUrl: string | null;
  memberCount: number;
  members: {
    id: string;
    displayName: string;
    email: string;
    imageUrl: string | null;
  }[];
};

export type PendingInvitationView = {
  id: string;
  email: string;
  createdAt: string;
};

export function serializeShoppingList(shoppingList: ShoppingList): SerializedShoppingList {
  return {
    id: shoppingList.id,
    name: shoppingList.name,
    imageUrl: shoppingList.imageUrl,
    memberCount: shoppingList.members.length,
    members: shoppingList.members.map((member) => ({
      id: member.id,
      displayName: member.displayName,
      email: member.email,
      imageUrl: member.imageUrl ?? null,
    })),
  };
}

/**
 * Serializes a pending invitation for the list-detail view.
 * The invitee's displayName and id are intentionally suppressed —
 * only the email snapshot and timestamps are exposed until acceptance.
 */
export function serializePendingInvitation(
  invitation: Invitation,
): PendingInvitationView {
  return {
    id: invitation.id,
    email: invitation.inviteeEmail,
    createdAt: invitation.createdAt.toISOString(),
  };
}
