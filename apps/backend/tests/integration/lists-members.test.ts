import { createJsonRequest, ensureBackendAvailable, registerUser, uniqueValue } from './helpers/api';
import { bearer, createShoppingListWithMembers, fetchShoppingList, newUser } from './helpers/lists';

describe('List Members Endpoints', () => {
  beforeAll(async () => {
    await ensureBackendAvailable();
  });

  describe('POST /api/lists/:id/members', () => {
    it('adds a member by email', async () => {
      const owner = await registerUser('members-add-owner');
      const newMember = await registerUser('members-add-new');

      const shoppingListRes = await createJsonRequest<{ shoppingList: { id: string } }>('/api/lists', {
        method: 'POST',
        headers: { Authorization: `Bearer ${owner.body.token}` },
        body: JSON.stringify({ name: uniqueValue('members-add-list') }),
      });
      const shoppingListId = shoppingListRes.body.shoppingList.id;

      const response = await createJsonRequest<{
        invitation: { id: string; shoppingListId: string; inviteeEmail: string; status: string; createdAt: string };
      }>(`/api/lists/${shoppingListId}/members`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${owner.body.token}` },
        body: JSON.stringify({ email: newMember.body.user.email }),
      });

      expect(response.status).toBe(201);
      expect(response.body.invitation).toEqual(
        expect.objectContaining({
          shoppingListId,
          inviteeEmail: newMember.body.user.email,
          status: 'pending',
        }),
      );
      expect(response.body.invitation).not.toHaveProperty('displayName');
      expect(response.body.invitation).not.toHaveProperty('shoppingList');

      const shoppingListDetail = await createJsonRequest<{
        shoppingList: {
          memberCount: number;
          members: Array<{ id: string; email: string }>;
          pendingInvitations: Array<{ id: string; email: string; createdAt: string }>;
        };
      }>(`/api/lists/${shoppingListId}`, {
        headers: { Authorization: `Bearer ${owner.body.token}` },
      });

      expect(shoppingListDetail.body.shoppingList.memberCount).toBe(1);
      expect(shoppingListDetail.body.shoppingList.members).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ email: newMember.body.user.email })]),
      );
      expect(shoppingListDetail.body.shoppingList.pendingInvitations).toHaveLength(1);
      expect(shoppingListDetail.body.shoppingList.pendingInvitations[0]).toEqual(
        expect.objectContaining({ email: newMember.body.user.email }),
      );
      expect(shoppingListDetail.body.shoppingList.pendingInvitations[0]).not.toHaveProperty('displayName');
      expect(shoppingListDetail.body.shoppingList.pendingInvitations[0]).not.toHaveProperty('inviteeId');
      expect(shoppingListDetail.body.shoppingList.pendingInvitations[0]).not.toHaveProperty('userId');
    });

    it('returns 201 for any email (no inviteeId in response)', async () => {
      const owner = await registerUser('members-add-nouser');

      const shoppingListRes = await createJsonRequest<{ shoppingList: { id: string } }>('/api/lists', {
        method: 'POST',
        headers: { Authorization: `Bearer ${owner.body.token}` },
        body: JSON.stringify({ name: uniqueValue('members-nouser-list') }),
      });
      const shoppingListId = shoppingListRes.body.shoppingList.id;

      const response = await createJsonRequest<{
        invitation: { id: string; shoppingListId: string; inviteeEmail: string; status: string; createdAt: string };
      }>(`/api/lists/${shoppingListId}/members`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${owner.body.token}` },
        body: JSON.stringify({ email: 'nonexistent@example.com' }),
      });

      expect(response.status).toBe(201);
      expect(response.body.invitation.inviteeEmail).toBe('nonexistent@example.com');
      expect(response.body.invitation).not.toHaveProperty('inviteeId');
      expect(response.body.invitation.status).toBe('pending');
    });

    it('returns 400 for already existing member', async () => {
      const owner = await registerUser('members-add-dup');
      const member = await registerUser('members-add-dup-target');

      const shoppingListRes = await createJsonRequest<{ shoppingList: { id: string } }>('/api/lists', {
        method: 'POST',
        headers: { Authorization: `Bearer ${owner.body.token}` },
        body: JSON.stringify({ name: uniqueValue('members-dup-list') }),
      });
      const shoppingListId = shoppingListRes.body.shoppingList.id;

      const inviteRes = await createJsonRequest<{ invitation: { id: string } }>(
        `/api/lists/${shoppingListId}/members`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${owner.body.token}` },
          body: JSON.stringify({ email: member.body.user.email }),
        },
      );

      await createJsonRequest(
        `/api/lists/${shoppingListId}/invitations/${inviteRes.body.invitation.id}/accept`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${member.body.token}` },
        },
      );

      const response = await createJsonRequest<{ message: string }>(
        `/api/lists/${shoppingListId}/members`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${owner.body.token}` },
          body: JSON.stringify({ email: member.body.user.email }),
        },
      );

      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/already a member/i);
    });

    it('returns 400 for missing email', async () => {
      const owner = await registerUser('members-add-noemail');

      const shoppingListRes = await createJsonRequest<{ shoppingList: { id: string } }>('/api/lists', {
        method: 'POST',
        headers: { Authorization: `Bearer ${owner.body.token}` },
        body: JSON.stringify({ name: uniqueValue('members-noemail-list') }),
      });
      const shoppingListId = shoppingListRes.body.shoppingList.id;

      const response = await createJsonRequest<{ message: string }>(
        `/api/lists/${shoppingListId}/members`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${owner.body.token}` },
          body: JSON.stringify({}),
        },
      );

      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/email is required/i);
    });

    it('rejects unauthenticated access', async () => {
      const response = await createJsonRequest<{ message: string }>('/api/lists/123/members', {
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com' }),
      });

      expect(response.status).toBe(401);
    });

    it('rejects non-member adding someone', async () => {
      const owner = await registerUser('members-add-reject-owner');
      const outsider = await registerUser('members-add-reject-outsider');
      const target = await registerUser('members-add-reject-target');

      const shoppingListRes = await createJsonRequest<{ shoppingList: { id: string } }>('/api/lists', {
        method: 'POST',
        headers: { Authorization: `Bearer ${owner.body.token}` },
        body: JSON.stringify({ name: uniqueValue('members-reject-list') }),
      });
      const shoppingListId = shoppingListRes.body.shoppingList.id;

      const response = await createJsonRequest<{ message: string }>(
        `/api/lists/${shoppingListId}/members`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${outsider.body.token}` },
          body: JSON.stringify({ email: target.body.user.email }),
        },
      );

      expect(response.status).toBe(404);
      expect(response.body.message).toMatch(/not found|not a member/i);
    });
  });

  describe('DELETE /api/lists/:id/members/:userId', () => {
    it('removes a member from the list', async () => {
      const owner = await registerUser('members-del-owner');
      const member = await registerUser('members-del-target');

      const shoppingListRes = await createJsonRequest<{ shoppingList: { id: string } }>('/api/lists', {
        method: 'POST',
        headers: { Authorization: `Bearer ${owner.body.token}` },
        body: JSON.stringify({ name: uniqueValue('members-del-list') }),
      });
      const shoppingListId = shoppingListRes.body.shoppingList.id;

      const inviteRes = await createJsonRequest<{ invitation: { id: string } }>(
        `/api/lists/${shoppingListId}/members`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${owner.body.token}` },
          body: JSON.stringify({ email: member.body.user.email }),
        },
      );

      await createJsonRequest(
        `/api/lists/${shoppingListId}/invitations/${inviteRes.body.invitation.id}/accept`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${member.body.token}` },
        },
      );

      const response = await createJsonRequest(
        `/api/lists/${shoppingListId}/members/${member.body.user.id}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${owner.body.token}` },
        },
      );

      expect(response.status).toBe(204);

      const shoppingListDetail = await createJsonRequest<{ shoppingList: { memberCount: number; members: Array<{ id: string }> } }>(
        `/api/lists/${shoppingListId}`,
        {
          headers: { Authorization: `Bearer ${owner.body.token}` },
        },
      );

      expect(shoppingListDetail.body.shoppingList.memberCount).toBe(1);
      expect(shoppingListDetail.body.shoppingList.members).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ id: member.body.user.id })]),
      );
    });

    it('returns 404 when a non-member tries to remove a member, and the member stays', async () => {
      const { shoppingListId, members } = await createShoppingListWithMembers('members-del-by-outsider', 1);
      const outsider = await newUser('members-del-by-outsider-caller');

      const response = await createJsonRequest<{ message: string }>(
        `/api/lists/${shoppingListId}/members/${members[1].user.id}`,
        { method: 'DELETE', headers: bearer(outsider.token) },
      );

      expect(response.status).toBe(404);
      const shoppingList = await fetchShoppingList(members[0].token, shoppingListId);
      expect(shoppingList.members.map((member) => member.id).sort()).toEqual(
        members.map((member) => member.user.id).sort(),
      );
    });

    it('returns 404 for user not in list', async () => {
      const owner = await registerUser('members-del-notmember-owner');
      const outsider = await registerUser('members-del-notmember-other');

      const shoppingListRes = await createJsonRequest<{ shoppingList: { id: string } }>('/api/lists', {
        method: 'POST',
        headers: { Authorization: `Bearer ${owner.body.token}` },
        body: JSON.stringify({ name: uniqueValue('members-del-notmember-list') }),
      });
      const shoppingListId = shoppingListRes.body.shoppingList.id;

      const response = await createJsonRequest<{ message: string }>(
        `/api/lists/${shoppingListId}/members/${outsider.body.user.id}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${owner.body.token}` },
        },
      );

      expect(response.status).toBe(404);
      expect(response.body.message).toMatch(/not a member/i);
    });

    it('rejects unauthenticated access', async () => {
      const response = await createJsonRequest<{ message: string }>('/api/lists/123/members/456', {
        method: 'DELETE',
      });

      expect(response.status).toBe(401);
    });
  });

  describe('PATCH /api/lists/:id', () => {
    it('updates the list name', async () => {
      const owner = await registerUser('lists-patch-owner');

      const shoppingListRes = await createJsonRequest<{ shoppingList: { id: string } }>('/api/lists', {
        method: 'POST',
        headers: { Authorization: `Bearer ${owner.body.token}` },
        body: JSON.stringify({ name: uniqueValue('lists-patch-orig') }),
      });
      const shoppingListId = shoppingListRes.body.shoppingList.id;
      const newName = uniqueValue('lists-patch-updated');

      const response = await createJsonRequest<{ shoppingList: { id: string; name: string } }>(
        `/api/lists/${shoppingListId}`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${owner.body.token}` },
          body: JSON.stringify({ name: newName }),
        },
      );

      expect(response.status).toBe(200);
      expect(response.body.shoppingList.name).toBe(newName);
    });

    it('returns 400 for empty name', async () => {
      const owner = await registerUser('lists-patch-empty');

      const shoppingListRes = await createJsonRequest<{ shoppingList: { id: string } }>('/api/lists', {
        method: 'POST',
        headers: { Authorization: `Bearer ${owner.body.token}` },
        body: JSON.stringify({ name: uniqueValue('lists-patch-empty-list') }),
      });
      const shoppingListId = shoppingListRes.body.shoppingList.id;

      const response = await createJsonRequest<{ message: string }>(
        `/api/lists/${shoppingListId}`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${owner.body.token}` },
          body: JSON.stringify({ name: '' }),
        },
      );

      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/list name is required/i);
    });

    it('rejects non-member updating', async () => {
      const owner = await registerUser('lists-patch-reject-owner');
      const outsider = await registerUser('lists-patch-reject-outsider');

      const shoppingListRes = await createJsonRequest<{ shoppingList: { id: string } }>('/api/lists', {
        method: 'POST',
        headers: { Authorization: `Bearer ${owner.body.token}` },
        body: JSON.stringify({ name: uniqueValue('lists-patch-reject-list') }),
      });
      const shoppingListId = shoppingListRes.body.shoppingList.id;

      const response = await createJsonRequest<{ message: string }>(
        `/api/lists/${shoppingListId}`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${outsider.body.token}` },
          body: JSON.stringify({ name: 'hacked' }),
        },
      );

      expect(response.status).toBe(404);
      expect(response.body.message).toMatch(/not found|not a member/i);
    });

    it('rejects unauthenticated access', async () => {
      const response = await createJsonRequest<{ message: string }>('/api/lists/123', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'hacked' }),
      });

      expect(response.status).toBe(401);
    });
  });
});
