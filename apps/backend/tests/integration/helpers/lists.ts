import { createJsonRequest, registerUser, uniqueValue } from './api';

export type TestUser = {
  token: string;
  user: { id: string; email: string; displayName: string };
};

export type ShoppingListDetail = {
  id: string;
  name: string;
  members: Array<{ id: string; email: string; displayName: string }>;
  pendingInvitations: Array<{ id: string; email: string }>;
};

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

/** A never-issued id: well-formed UUID, so it reaches the lookup rather than the shape check. */
export const UNKNOWN_ID = '00000000-0000-0000-0000-000000000000';

export const newUser = async (prefix: string): Promise<TestUser> => {
  const response = await registerUser(prefix);
  if (response.status !== 201) {
    throw new Error(`register ${prefix} failed with ${response.status}`);
  }
  return response.body;
};

/**
 * Registers an owner plus `extraMembers` users, creates a list as the owner
 * and has every extra user accept an invitation. `members[0]` is the owner.
 */
export const createShoppingListWithMembers = async (
  prefix: string,
  extraMembers = 1,
): Promise<{ shoppingListId: string; members: TestUser[] }> => {
  const owner = await newUser(prefix);
  const shoppingListRes = await createJsonRequest<{ shoppingList: { id: string } }>('/api/lists', {
    method: 'POST',
    headers: bearer(owner.token),
    body: JSON.stringify({ name: uniqueValue(`${prefix}-shoppingList`) }),
  });
  const shoppingListId = shoppingListRes.body.shoppingList.id;
  const members = [owner];

  for (let index = 0; index < extraMembers; index += 1) {
    const member = await newUser(`${prefix}-m${index + 1}`);
    const inviteRes = await createJsonRequest<{ invitation: { id: string } }>(`/api/lists/${shoppingListId}/members`, {
      method: 'POST',
      headers: bearer(owner.token),
      body: JSON.stringify({ email: member.user.email }),
    });
    const acceptRes = await createJsonRequest(
      `/api/lists/${shoppingListId}/invitations/${inviteRes.body.invitation.id}/accept`,
      { method: 'POST', headers: bearer(member.token) },
    );
    if (acceptRes.status !== 200) {
      throw new Error(`accept for ${prefix} member ${index + 1} failed with ${acceptRes.status}`);
    }
    members.push(member);
  }

  return { shoppingListId, members };
};

/** Creates a standalone list owned by a fresh user. */
export const createSoloShoppingList = async (prefix: string) => {
  const { shoppingListId, members } = await createShoppingListWithMembers(prefix, 0);
  return { shoppingListId, owner: members[0] };
};

export const fetchShoppingList = async (token: string, shoppingListId: string): Promise<ShoppingListDetail> => {
  const response = await createJsonRequest<{ shoppingList: ShoppingListDetail }>(`/api/lists/${shoppingListId}`, {
    headers: bearer(token),
  });
  if (response.status !== 200) {
    throw new Error(`GET list ${shoppingListId} failed with ${response.status}`);
  }
  return response.body.shoppingList;
};
