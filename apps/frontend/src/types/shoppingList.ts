export type ShoppingListMember = {
  id: string;
  displayName: string;
  email: string;
  imageUrl: string | null;
};

export type PendingInvitation = {
  id: string;
  email: string;
  createdAt: string;
};

export type ShoppingList = {
  id: string;
  name: string;
  imageUrl: string | null;
  memberCount: number;
  members: ShoppingListMember[];
  pendingInvitations?: PendingInvitation[];
};

export type InvitationListItem = {
  id: string;
  shoppingListId: string;
  shoppingListName: string;
  inviterName: string;
  createdAt: string;
};

export type ShoppingListsResponse = {
  shoppingLists: ShoppingList[];
  invitations: InvitationListItem[];
};

export type ShoppingListDetail = ShoppingList & {
  pendingInvitations: PendingInvitation[];
};
