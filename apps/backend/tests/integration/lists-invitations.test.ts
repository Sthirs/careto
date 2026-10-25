import { createJsonRequest, ensureBackendAvailable, registerUser, uniqueValue } from './helpers/api';
import { bearer, createSoloShoppingList, fetchShoppingList, newUser } from './helpers/lists';

const FAKE_INVITATION_ID = '00000000-0000-0000-0000-000000000000';

describe('List Invitations', () => {
  beforeAll(async () => {
    await ensureBackendAvailable();
  });

  describe('POST /api/lists/:id/members (invitation creation)', () => {
    it('creates a pending invitation for a registered user (201, no inviteeId in response)', async () => {
      const owner = await registerUser('inv-create-owner');
      const invitee = await registerUser('inv-create-invitee');

      const shoppingListRes = await createJsonRequest<{ shoppingList: { id: string } }>('/api/lists', {
        method: 'POST',
        headers: { Authorization: `Bearer ${owner.body.token}` },
        body: JSON.stringify({ name: uniqueValue('inv-create-list') }),
      });
      const shoppingListId = shoppingListRes.body.shoppingList.id;

      const response = await createJsonRequest<{
        invitation: { id: string; shoppingListId: string; inviteeEmail: string; status: string; createdAt: string };
      }>(`/api/lists/${shoppingListId}/members`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${owner.body.token}` },
        body: JSON.stringify({ email: invitee.body.user.email }),
      });

      expect(response.status).toBe(201);
      expect(response.body.invitation.shoppingListId).toBe(shoppingListId);
      expect(response.body.invitation.inviteeEmail).toBe(invitee.body.user.email);
      expect(response.body.invitation).not.toHaveProperty('inviteeId');
      expect(response.body.invitation.status).toBe('pending');
      expect(response.body.invitation).not.toHaveProperty('displayName');
    });

    it('creates a pending invitation for an unknown email (201, no inviteeId for unknown email)', async () => {
      const owner = await registerUser('inv-unknown-owner');
      const unknownEmail = `${uniqueValue('inv-unknown')}-unknown@example.com`;

      const shoppingListRes = await createJsonRequest<{ shoppingList: { id: string } }>('/api/lists', {
        method: 'POST',
        headers: { Authorization: `Bearer ${owner.body.token}` },
        body: JSON.stringify({ name: uniqueValue('inv-unknown-list') }),
      });
      const shoppingListId = shoppingListRes.body.shoppingList.id;

      const response = await createJsonRequest<{
        invitation: { id: string; shoppingListId: string; inviteeEmail: string; status: string; createdAt: string };
      }>(`/api/lists/${shoppingListId}/members`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${owner.body.token}` },
        body: JSON.stringify({ email: unknownEmail }),
      });

      expect(response.status).toBe(201);
      expect(response.body.invitation.inviteeEmail).toBe(unknownEmail);
      expect(response.body.invitation).not.toHaveProperty('inviteeId');
      expect(response.body.invitation.status).toBe('pending');
    });

    it('returns 400 for missing email', async () => {
      const owner = await registerUser('inv-missing-owner');

      const shoppingListRes = await createJsonRequest<{ shoppingList: { id: string } }>('/api/lists', {
        method: 'POST',
        headers: { Authorization: `Bearer ${owner.body.token}` },
        body: JSON.stringify({ name: uniqueValue('inv-missing-list') }),
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

    it('returns 404 for nonexistent list', async () => {
      const owner = await registerUser('inv-noshoppingList-owner');

      const response = await createJsonRequest<{ message: string }>(
        `/api/lists/${FAKE_INVITATION_ID}/members`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${owner.body.token}` },
          body: JSON.stringify({ email: 'someone@example.com' }),
        },
      );

      expect(response.status).toBe(404);
      expect(response.body.message).toMatch(/not found|not a member/i);
    });

    it('returns 404 when caller is not a member', async () => {
      const owner = await registerUser('inv-nonmember-owner');
      const outsider = await registerUser('inv-nonmember-outsider');
      const target = await registerUser('inv-nonmember-target');

      const shoppingListRes = await createJsonRequest<{ shoppingList: { id: string } }>('/api/lists', {
        method: 'POST',
        headers: { Authorization: `Bearer ${owner.body.token}` },
        body: JSON.stringify({ name: uniqueValue('inv-nonmember-list') }),
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

    it('(privacy) registered and unregistered invitees return identical response shape (no enumeration oracle)', async () => {
      const owner = await registerUser('inv-priv-owner');
      const invitee = await registerUser('inv-priv-invitee');
      const unregisteredEmail = `${uniqueValue('inv-priv-unreg')}@example.com`;

      const shoppingListRes = await createJsonRequest<{ shoppingList: { id: string } }>('/api/lists', {
        method: 'POST',
        headers: { Authorization: `Bearer ${owner.body.token}` },
        body: JSON.stringify({ name: uniqueValue('inv-priv-list') }),
      });
      const shoppingListId = shoppingListRes.body.shoppingList.id;

      const registeredResponse = await createJsonRequest<{
        invitation: Record<string, unknown>;
      }>(`/api/lists/${shoppingListId}/members`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${owner.body.token}` },
        body: JSON.stringify({ email: invitee.body.user.email }),
      });

      const unregisteredResponse = await createJsonRequest<{
        invitation: Record<string, unknown>;
      }>(`/api/lists/${shoppingListId}/members`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${owner.body.token}` },
        body: JSON.stringify({ email: unregisteredEmail }),
      });

      expect(registeredResponse.status).toBe(201);
      expect(unregisteredResponse.status).toBe(201);

      // No enumeration oracle: the response shape must be identical whether or
      // not the invitee is a registered user.
      expect(registeredResponse.body.invitation).not.toHaveProperty('inviteeId');
      expect(unregisteredResponse.body.invitation).not.toHaveProperty('inviteeId');

      expect(Object.keys(registeredResponse.body.invitation).sort()).toStrictEqual([
        'createdAt',
        'shoppingListId',
        'id',
        'inviteeEmail',
        'status',
      ]);
      expect(Object.keys(unregisteredResponse.body.invitation).sort()).toStrictEqual([
        'createdAt',
        'shoppingListId',
        'id',
        'inviteeEmail',
        'status',
      ]);
    });
  });

  describe('email format validation', () => {
    const malformedEmailCases: Array<{ description: string; email: string }> = [
      { description: 'missing local part and domain', email: 'foo' },
      { description: 'missing domain', email: 'foo@' },
      { description: 'missing TLD dot', email: 'foo@bar' },
      { description: 'multiple @ characters', email: 'a@b@c' },
      { description: 'embedded space is invalid format', email: 'foo bar@x.com' },
      { description: 'over 254 char length cap', email: `${'x'.repeat(256)}@x.com` },
    ];

    for (const { description, email } of malformedEmailCases) {
      it(`returns 400 for malformed email (${description})`, async () => {
        const owner = await registerUser(`inv-fmt-${description.replace(/\s+/g, '-')}-owner`);

        const shoppingListRes = await createJsonRequest<{ shoppingList: { id: string } }>('/api/lists', {
          method: 'POST',
          headers: { Authorization: `Bearer ${owner.body.token}` },
          body: JSON.stringify({ name: uniqueValue(`inv-fmt-${description.replace(/\s+/g, '-')}-shoppingList`) }),
        });
        const shoppingListId = shoppingListRes.body.shoppingList.id;

        const response = await createJsonRequest<{ message: string }>(
          `/api/lists/${shoppingListId}/members`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${owner.body.token}` },
            body: JSON.stringify({ email }),
          },
        );

        expect(response.status).toBe(400);
        expect(response.body.message).toMatch(/email is required/i);
      });
    }

    it('returns 201 for whitespace-padded valid email (proves trim() runs before regex)', async () => {
      const owner = await registerUser('inv-fmt-trim-owner');

      const shoppingListRes = await createJsonRequest<{ shoppingList: { id: string } }>('/api/lists', {
        method: 'POST',
        headers: { Authorization: `Bearer ${owner.body.token}` },
        body: JSON.stringify({ name: uniqueValue('inv-fmt-trim-list') }),
      });
      const shoppingListId = shoppingListRes.body.shoppingList.id;

      const response = await createJsonRequest<{
        invitation: { inviteeEmail: string; status: string };
      }>(`/api/lists/${shoppingListId}/members`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${owner.body.token}` },
        body: JSON.stringify({ email: '  x@y.com  ' }),
      });

      expect(response.status).toBe(201);
      expect(response.body.invitation.inviteeEmail).toBe('x@y.com');
      expect(response.body.invitation).not.toHaveProperty('inviteeId');
      expect(response.body.invitation.status).toBe('pending');
    });
  });

  describe('Deferred attach on register', () => {
    it('attaches pending invitations when a matching user registers', async () => {
      const owner = await registerUser('inv-deferred-owner');
      const deferredEmail = `${uniqueValue('inv-deferred')}-deferred@example.com`;

      const shoppingListRes = await createJsonRequest<{ shoppingList: { id: string } }>('/api/lists', {
        method: 'POST',
        headers: { Authorization: `Bearer ${owner.body.token}` },
        body: JSON.stringify({ name: uniqueValue('inv-deferred-list') }),
      });
      const shoppingListId = shoppingListRes.body.shoppingList.id;

      const inviteRes = await createJsonRequest<{
        invitation: Record<string, unknown>;
      }>(`/api/lists/${shoppingListId}/members`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${owner.body.token}` },
        body: JSON.stringify({ email: deferredEmail }),
      });

      expect(inviteRes.status).toBe(201);
      expect(inviteRes.body.invitation).not.toHaveProperty('inviteeId');

      const newUserRes = await createJsonRequest<{ token: string; user: { id: string; email: string } }>(
        '/api/auth/register',
        {
          method: 'POST',
          body: JSON.stringify({
            email: deferredEmail,
            password: 'password123',
            displayName: uniqueValue('Deferred User'),
          }),
        },
      );

      expect(newUserRes.status).toBe(201);

      const shoppingListsRes = await createJsonRequest<{
        invitations: Array<{ id: string; shoppingListId: string; shoppingListName: string; inviterName: string; createdAt: string }>;
      }>('/api/lists', {
        headers: { Authorization: `Bearer ${newUserRes.body.token}` },
      });

      expect(shoppingListsRes.status).toBe(200);
      const matchingInvitation = shoppingListsRes.body.invitations.find((inv) => inv.shoppingListId === shoppingListId);
      expect(matchingInvitation).toBeDefined();
    });
  });

  describe('POST /api/lists/:id/invitations/:invitationId/accept', () => {
    it('accepts an invitation (200, invitee becomes member)', async () => {
      const owner = await registerUser('inv-accept-owner');
      const invitee = await registerUser('inv-accept-invitee');

      const shoppingListRes = await createJsonRequest<{ shoppingList: { id: string } }>('/api/lists', {
        method: 'POST',
        headers: { Authorization: `Bearer ${owner.body.token}` },
        body: JSON.stringify({ name: uniqueValue('inv-accept-list') }),
      });
      const shoppingListId = shoppingListRes.body.shoppingList.id;

      const inviteRes = await createJsonRequest<{ invitation: { id: string } }>(
        `/api/lists/${shoppingListId}/members`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${owner.body.token}` },
          body: JSON.stringify({ email: invitee.body.user.email }),
        },
      );
      const invitationId = inviteRes.body.invitation.id;

      const response = await createJsonRequest<{
        invitation: { id: string; status: string };
      }>(`/api/lists/${shoppingListId}/invitations/${invitationId}/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${invitee.body.token}` },
      });

      expect(response.status).toBe(200);
      expect(response.body.invitation.status).toBe('accepted');

      const shoppingListDetail = await createJsonRequest<{
        shoppingList: { members: Array<{ id: string; displayName: string }> };
      }>(`/api/lists/${shoppingListId}`, {
        headers: { Authorization: `Bearer ${owner.body.token}` },
      });

      expect(shoppingListDetail.body.shoppingList.members).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: invitee.body.user.id, displayName: invitee.body.user.displayName }),
        ]),
      );
    });

    it('returns 404 for non-existent invitation', async () => {
      const owner = await registerUser('inv-accept-notfound-owner');

      const shoppingListRes = await createJsonRequest<{ shoppingList: { id: string } }>('/api/lists', {
        method: 'POST',
        headers: { Authorization: `Bearer ${owner.body.token}` },
        body: JSON.stringify({ name: uniqueValue('inv-accept-notfound-list') }),
      });
      const shoppingListId = shoppingListRes.body.shoppingList.id;

      const response = await createJsonRequest<{ message: string }>(
        `/api/lists/${shoppingListId}/invitations/${FAKE_INVITATION_ID}/accept`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${owner.body.token}` },
        },
      );

      expect(response.status).toBe(404);
      expect(response.body.message).toMatch(/not found/i);
    });

    it('returns 403 when caller is not the invitee', async () => {
      const owner = await registerUser('inv-accept-notinvitee-owner');
      const invitee = await registerUser('inv-accept-notinvitee-invitee');
      const other = await registerUser('inv-accept-notinvitee-other');

      const shoppingListRes = await createJsonRequest<{ shoppingList: { id: string } }>('/api/lists', {
        method: 'POST',
        headers: { Authorization: `Bearer ${owner.body.token}` },
        body: JSON.stringify({ name: uniqueValue('inv-accept-notinvitee-list') }),
      });
      const shoppingListId = shoppingListRes.body.shoppingList.id;

      const inviteRes = await createJsonRequest<{ invitation: { id: string } }>(
        `/api/lists/${shoppingListId}/members`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${owner.body.token}` },
          body: JSON.stringify({ email: invitee.body.user.email }),
        },
      );
      const invitationId = inviteRes.body.invitation.id;

      const response = await createJsonRequest<{ message: string }>(
        `/api/lists/${shoppingListId}/invitations/${invitationId}/accept`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${other.body.token}` },
        },
      );

      expect(response.status).toBe(403);
      expect(response.body.message).toMatch(/not the invitee/i);
    });

    it('returns 400 when invitation is no longer pending', async () => {
      const owner = await registerUser('inv-accept-notpending-owner');
      const invitee = await registerUser('inv-accept-notpending-invitee');

      const shoppingListRes = await createJsonRequest<{ shoppingList: { id: string } }>('/api/lists', {
        method: 'POST',
        headers: { Authorization: `Bearer ${owner.body.token}` },
        body: JSON.stringify({ name: uniqueValue('inv-accept-notpending-list') }),
      });
      const shoppingListId = shoppingListRes.body.shoppingList.id;

      const inviteRes = await createJsonRequest<{ invitation: { id: string } }>(
        `/api/lists/${shoppingListId}/members`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${owner.body.token}` },
          body: JSON.stringify({ email: invitee.body.user.email }),
        },
      );
      const invitationId = inviteRes.body.invitation.id;

      await createJsonRequest(
        `/api/lists/${shoppingListId}/invitations/${invitationId}/decline`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${invitee.body.token}` },
        },
      );

      const response = await createJsonRequest<{ message: string }>(
        `/api/lists/${shoppingListId}/invitations/${invitationId}/accept`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${invitee.body.token}` },
        },
      );

      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/no longer pending/i);
    });

    it('rejects unauthenticated access', async () => {
      const response = await createJsonRequest<{ message: string }>(
        `/api/lists/${FAKE_INVITATION_ID}/invitations/${FAKE_INVITATION_ID}/accept`,
        {
          method: 'POST',
        },
      );

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/lists/:id/invitations/:invitationId/decline', () => {
    it('declines an invitation (200, then not listed)', async () => {
      const owner = await registerUser('inv-decline-owner');
      const invitee = await registerUser('inv-decline-invitee');

      const shoppingListRes = await createJsonRequest<{ shoppingList: { id: string } }>('/api/lists', {
        method: 'POST',
        headers: { Authorization: `Bearer ${owner.body.token}` },
        body: JSON.stringify({ name: uniqueValue('inv-decline-list') }),
      });
      const shoppingListId = shoppingListRes.body.shoppingList.id;

      const inviteRes = await createJsonRequest<{ invitation: { id: string } }>(
        `/api/lists/${shoppingListId}/members`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${owner.body.token}` },
          body: JSON.stringify({ email: invitee.body.user.email }),
        },
      );
      const invitationId = inviteRes.body.invitation.id;

      const response = await createJsonRequest<{
        invitation: { id: string; status: string };
      }>(`/api/lists/${shoppingListId}/invitations/${invitationId}/decline`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${invitee.body.token}` },
      });

      expect(response.status).toBe(200);
      expect(response.body.invitation.status).toBe('declined');

      const shoppingListsRes = await createJsonRequest<{
        invitations: Array<{ id: string }>;
      }>('/api/lists', {
        headers: { Authorization: `Bearer ${invitee.body.token}` },
      });

      expect(shoppingListsRes.body.invitations).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ id: invitationId })]),
      );

      const shoppingListDetail = await createJsonRequest<{
        shoppingList: { pendingInvitations: Array<{ id: string }> };
      }>(`/api/lists/${shoppingListId}`, {
        headers: { Authorization: `Bearer ${owner.body.token}` },
      });

      expect(shoppingListDetail.body.shoppingList.pendingInvitations).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ id: invitationId })]),
      );
    });

    it('allows re-inviting after decline (decline-then-reinvite)', async () => {
      const owner = await registerUser('inv-reinvite-owner');
      const invitee = await registerUser('inv-reinvite-invitee');

      const shoppingListRes = await createJsonRequest<{ shoppingList: { id: string } }>('/api/lists', {
        method: 'POST',
        headers: { Authorization: `Bearer ${owner.body.token}` },
        body: JSON.stringify({ name: uniqueValue('inv-reinvite-list') }),
      });
      const shoppingListId = shoppingListRes.body.shoppingList.id;

      const firstInvite = await createJsonRequest<{ invitation: { id: string; status: string } }>(
        `/api/lists/${shoppingListId}/members`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${owner.body.token}` },
          body: JSON.stringify({ email: invitee.body.user.email }),
        },
      );

      expect(firstInvite.status).toBe(201);
      expect(firstInvite.body.invitation.status).toBe('pending');

      const declineRes = await createJsonRequest<{ invitation: { status: string } }>(
        `/api/lists/${shoppingListId}/invitations/${firstInvite.body.invitation.id}/decline`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${invitee.body.token}` },
        },
      );

      expect(declineRes.status).toBe(200);
      expect(declineRes.body.invitation.status).toBe('declined');

      const secondInvite = await createJsonRequest<{ invitation: { id: string; status: string } }>(
        `/api/lists/${shoppingListId}/members`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${owner.body.token}` },
          body: JSON.stringify({ email: invitee.body.user.email }),
        },
      );

      expect(secondInvite.status).toBe(201);
      expect(secondInvite.body.invitation.status).toBe('pending');
      expect(secondInvite.body.invitation.id).not.toBe(firstInvite.body.invitation.id);
    });
  });

  describe('DELETE /api/lists/:id/invitations/:invitationId (cancel)', () => {
    it('cancels an invitation (204)', async () => {
      const owner = await registerUser('inv-cancel-owner');
      const invitee = await registerUser('inv-cancel-invitee');

      const shoppingListRes = await createJsonRequest<{ shoppingList: { id: string } }>('/api/lists', {
        method: 'POST',
        headers: { Authorization: `Bearer ${owner.body.token}` },
        body: JSON.stringify({ name: uniqueValue('inv-cancel-list') }),
      });
      const shoppingListId = shoppingListRes.body.shoppingList.id;

      const inviteRes = await createJsonRequest<{ invitation: { id: string } }>(
        `/api/lists/${shoppingListId}/members`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${owner.body.token}` },
          body: JSON.stringify({ email: invitee.body.user.email }),
        },
      );
      const invitationId = inviteRes.body.invitation.id;

      const response = await createJsonRequest(
        `/api/lists/${shoppingListId}/invitations/${invitationId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${owner.body.token}` },
        },
      );

      expect(response.status).toBe(204);

      const shoppingListDetail = await createJsonRequest<{
        shoppingList: { pendingInvitations: Array<{ id: string }> };
      }>(`/api/lists/${shoppingListId}`, {
        headers: { Authorization: `Bearer ${owner.body.token}` },
      });

      expect(shoppingListDetail.body.shoppingList.pendingInvitations).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ id: invitationId })]),
      );
    });

    it('returns 404 for non-existent invitation', async () => {
      const owner = await registerUser('inv-cancel-notfound-owner');

      const shoppingListRes = await createJsonRequest<{ shoppingList: { id: string } }>('/api/lists', {
        method: 'POST',
        headers: { Authorization: `Bearer ${owner.body.token}` },
        body: JSON.stringify({ name: uniqueValue('inv-cancel-notfound-list') }),
      });
      const shoppingListId = shoppingListRes.body.shoppingList.id;

      const response = await createJsonRequest<{ message: string }>(
        `/api/lists/${shoppingListId}/invitations/${FAKE_INVITATION_ID}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${owner.body.token}` },
        },
      );

      expect(response.status).toBe(404);
      expect(response.body.message).toMatch(/not found/i);
    });

    it('returns 403 when caller is not the inviter', async () => {
      const owner = await registerUser('inv-cancel-notinviter-owner');
      const invitee = await registerUser('inv-cancel-notinviter-invitee');

      const shoppingListRes = await createJsonRequest<{ shoppingList: { id: string } }>('/api/lists', {
        method: 'POST',
        headers: { Authorization: `Bearer ${owner.body.token}` },
        body: JSON.stringify({ name: uniqueValue('inv-cancel-notinviter-list') }),
      });
      const shoppingListId = shoppingListRes.body.shoppingList.id;

      const inviteRes = await createJsonRequest<{ invitation: { id: string } }>(
        `/api/lists/${shoppingListId}/members`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${owner.body.token}` },
          body: JSON.stringify({ email: invitee.body.user.email }),
        },
      );
      const invitationId = inviteRes.body.invitation.id;

      const response = await createJsonRequest<{ message: string }>(
        `/api/lists/${shoppingListId}/invitations/${invitationId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${invitee.body.token}` },
        },
      );

      expect(response.status).toBe(403);
      expect(response.body.message).toMatch(/not the inviter/i);
    });

    it('returns 400 when invitation is no longer pending', async () => {
      const owner = await registerUser('inv-cancel-notpending-owner');
      const invitee = await registerUser('inv-cancel-notpending-invitee');

      const shoppingListRes = await createJsonRequest<{ shoppingList: { id: string } }>('/api/lists', {
        method: 'POST',
        headers: { Authorization: `Bearer ${owner.body.token}` },
        body: JSON.stringify({ name: uniqueValue('inv-cancel-notpending-list') }),
      });
      const shoppingListId = shoppingListRes.body.shoppingList.id;

      const inviteRes = await createJsonRequest<{ invitation: { id: string } }>(
        `/api/lists/${shoppingListId}/members`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${owner.body.token}` },
          body: JSON.stringify({ email: invitee.body.user.email }),
        },
      );
      const invitationId = inviteRes.body.invitation.id;

      await createJsonRequest(
        `/api/lists/${shoppingListId}/invitations/${invitationId}/accept`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${invitee.body.token}` },
        },
      );

      const response = await createJsonRequest<{ message: string }>(
        `/api/lists/${shoppingListId}/invitations/${invitationId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${owner.body.token}` },
        },
      );

      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/no longer pending/i);
    });
  });

  describe('GET /api/lists extensions', () => {
    it('returns empty invitations array when none pending', async () => {
      const user = await registerUser('inv-list-empty');

      const response = await createJsonRequest<{
        shoppingLists: unknown[];
        invitations: unknown[];
      }>('/api/lists', {
        headers: { Authorization: `Bearer ${user.body.token}` },
      });

      expect(response.status).toBe(200);
      expect(response.body.invitations).toEqual([]);
    });

    it('returns pending invitations for the invitee', async () => {
      const owner = await registerUser('inv-list-owner');
      const invitee = await registerUser('inv-list-invitee');

      const shoppingListRes = await createJsonRequest<{ shoppingList: { id: string } }>('/api/lists', {
        method: 'POST',
        headers: { Authorization: `Bearer ${owner.body.token}` },
        body: JSON.stringify({ name: uniqueValue('inv-list-list') }),
      });
      const shoppingListId = shoppingListRes.body.shoppingList.id;

      await createJsonRequest(`/api/lists/${shoppingListId}/members`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${owner.body.token}` },
        body: JSON.stringify({ email: invitee.body.user.email }),
      });

      const response = await createJsonRequest<{
        invitations: Array<{ id: string; shoppingListId: string; shoppingListName: string; inviterName: string; createdAt: string }>;
      }>('/api/lists', {
        headers: { Authorization: `Bearer ${invitee.body.token}` },
      });

      expect(response.status).toBe(200);
      const matching = response.body.invitations.find((inv) => inv.shoppingListId === shoppingListId);
      expect(matching).toBeDefined();
      expect(matching).toEqual(
        expect.objectContaining({
          shoppingListId,
          shoppingListName: expect.any(String),
          inviterName: expect.any(String),
        }),
      );
    });
  });

  describe('GET /api/lists/:id extensions', () => {
    it('returns pendingInvitations with email-only shape', async () => {
      const owner = await registerUser('inv-detail-owner');
      const invitee = await registerUser('inv-detail-invitee');

      const shoppingListRes = await createJsonRequest<{ shoppingList: { id: string } }>('/api/lists', {
        method: 'POST',
        headers: { Authorization: `Bearer ${owner.body.token}` },
        body: JSON.stringify({ name: uniqueValue('inv-detail-list') }),
      });
      const shoppingListId = shoppingListRes.body.shoppingList.id;

      await createJsonRequest(`/api/lists/${shoppingListId}/members`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${owner.body.token}` },
        body: JSON.stringify({ email: invitee.body.user.email }),
      });

      const response = await createJsonRequest<{
        shoppingList: {
          members: Array<{ id: string }>;
          pendingInvitations: Array<{ id: string; email: string; createdAt: string }>;
        };
      }>(`/api/lists/${shoppingListId}`, {
        headers: { Authorization: `Bearer ${owner.body.token}` },
      });

      expect(response.status).toBe(200);
      expect(response.body.shoppingList.pendingInvitations).toHaveLength(1);

      const item = response.body.shoppingList.pendingInvitations[0];
      expect(item).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          email: invitee.body.user.email,
          createdAt: expect.any(String),
        }),
      );
      expect(item).not.toHaveProperty('inviteeId');
      expect(item).not.toHaveProperty('displayName');
      expect(item).not.toHaveProperty('userId');

      expect(response.body.shoppingList.members).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ id: invitee.body.user.id })]),
      );
    });
  });

  describe('invitation edge cases', () => {
    const invite = (token: string, shoppingListId: string, email: string) =>
      createJsonRequest<{ invitation: { id: string }; message?: string }>(`/api/lists/${shoppingListId}/members`, {
        method: 'POST',
        headers: bearer(token),
        body: JSON.stringify({ email }),
      });

    it('returns 400 for a second invitation to an email that already has one pending, and keeps a single pending entry', async () => {
      const { shoppingListId, owner } = await createSoloShoppingList('inv-dup');
      const email = `${uniqueValue('inv-dup-target')}@example.com`;

      expect((await invite(owner.token, shoppingListId, email)).status).toBe(201);
      const second = await invite(owner.token, shoppingListId, email.toUpperCase());

      expect(second.status).toBe(400);
      expect(second.body.message).toMatch(/already pending/i);
      const shoppingList = await fetchShoppingList(owner.token, shoppingListId);
      expect(shoppingList.pendingInvitations.filter((pending) => pending.email === email)).toHaveLength(1);
    });

    it('decline: 404 for an unknown invitation', async () => {
      const { shoppingListId, owner } = await createSoloShoppingList('inv-decline-unknown');

      const response = await createJsonRequest(`/api/lists/${shoppingListId}/invitations/${FAKE_INVITATION_ID}/decline`, {
        method: 'POST',
        headers: bearer(owner.token),
      });

      expect(response.status).toBe(404);
    });

    it('decline: 403 when the caller is not the invitee, and the invitation stays pending', async () => {
      const { shoppingListId, owner } = await createSoloShoppingList('inv-decline-wrong-user');
      const invitee = await newUser('inv-decline-wrong-user-invitee');
      const invitation = await invite(owner.token, shoppingListId, invitee.user.email);

      const response = await createJsonRequest<{ message: string }>(
        `/api/lists/${shoppingListId}/invitations/${invitation.body.invitation.id}/decline`,
        { method: 'POST', headers: bearer(owner.token) },
      );

      expect(response.status).toBe(403);
      expect(response.body.message).toMatch(/not the invitee/i);
      expect((await fetchShoppingList(owner.token, shoppingListId)).pendingInvitations).toHaveLength(1);
    });

    it('decline: 400 once the invitation has already been accepted', async () => {
      const { shoppingListId, owner } = await createSoloShoppingList('inv-decline-accepted');
      const invitee = await newUser('inv-decline-accepted-invitee');
      const invitation = await invite(owner.token, shoppingListId, invitee.user.email);
      const invitationPath = `/api/lists/${shoppingListId}/invitations/${invitation.body.invitation.id}`;
      await createJsonRequest(`${invitationPath}/accept`, { method: 'POST', headers: bearer(invitee.token) });

      const response = await createJsonRequest<{ message: string }>(`${invitationPath}/decline`, {
        method: 'POST',
        headers: bearer(invitee.token),
      });

      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/no longer pending/i);
      expect((await fetchShoppingList(owner.token, shoppingListId)).members.map((member) => member.id)).toContain(invitee.user.id);
    });

    it('decline and cancel reject unauthenticated access', async () => {
      const declineRes = await createJsonRequest(
        `/api/lists/${FAKE_INVITATION_ID}/invitations/${FAKE_INVITATION_ID}/decline`,
        { method: 'POST' },
      );
      expect(declineRes.status).toBe(401);

      const cancelRes = await createJsonRequest(`/api/lists/${FAKE_INVITATION_ID}/invitations/${FAKE_INVITATION_ID}`, {
        method: 'DELETE',
      });
      expect(cancelRes.status).toBe(401);
    });
  });
});
