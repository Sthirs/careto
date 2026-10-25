/**
 * Characterization tests for `shoppingListController.ts` (todo 9,
 * `.omo/plans/remove-ai-slop.md`).
 *
 * Purpose: pin the CURRENT validation and status-code behavior of all
 * exported handlers at UNIT level — no cluster, no Postgres — so the
 * upcoming controller split (todo 18) and the `request.auth!`
 * type-narrowing (todo 19) have a local safety net. These tests do not
 * judge whether a given status code is "correct"; they lock what the
 * code does TODAY.
 *
 * Strategy: drive the real Express app (`createApp()`) via supertest so
 * routing + `requireAuth` + multer middleware are exercised exactly as
 * in production, but stub every service-layer call with
 * `vi.spyOn(...prototype, ...)` (matching the established pattern in
 * `tests/oauth/oauth-controller.test.ts`). `ShoppingListService` and
 * `AuthService` both read a TypeORM repository in a field initializer
 * that runs at construction time (the controllers construct singletons
 * at module load), so `../src/db/data-source` is mocked FIRST to avoid
 * touching real Postgres.
 */
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db/data-source', () => ({
  AppDataSource: {
    getRepository: vi.fn(() => ({})),
    transaction: vi.fn(),
  },
  initializeDatabase: vi.fn(async () => undefined),
}));

vi.mock('../src/services/imageService', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../src/services/imageService')>();
  return {
    ...actual,
    normalizeToDataUrl: vi.fn(),
  };
});

import { createApp } from '../src/app';
import { AuthService } from '../src/services/authService';
import { ShoppingListService } from '../src/services/shoppingListService';
import { invitationService } from '../src/services/invitationService';
import {
  normalizeToDataUrl,
  UnsupportedImageTypeError,
} from '../src/services/imageService';

const JWT_SECRET = 'change-me-in-real-environments';
const AUTH_USER = {
  id: 'u1',
  email: 'u@careto.local',
  displayName: 'U',
  language: 'en' as const,
};

function bearerAuth(userId = 'u1') {
  return {
    Authorization: `Bearer ${jwt.sign({ userId, email: AUTH_USER.email }, JWT_SECRET)}`,
  };
}

describe('shoppingListController (unit, service layer mocked)', () => {
  beforeEach(() => {
    vi.spyOn(AuthService.prototype, 'findById').mockResolvedValue(
      AUTH_USER as never,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------
  // listShoppingLists — GET /api/lists
  // ---------------------------------------------------------------
  describe('listShoppingLists', () => {
    it('happy: 200 with { shoppingLists, invitations }', async () => {
      vi.spyOn(ShoppingListService.prototype, 'getShoppingListsForUser').mockResolvedValue([
        { id: 'g1' },
      ] as never);
      vi.spyOn(invitationService, 'listPendingForInvitee').mockResolvedValue([
        { id: 'i1' },
      ] as never);

      const app = createApp();
      const response = await request(app).get('/api/lists').set(bearerAuth());

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        shoppingLists: [{ id: 'g1' }],
        invitations: [{ id: 'i1' }],
      });
    });

    it('error branch: unauthenticated request → 401 (no handler-level try/catch exists)', async () => {
      const app = createApp();
      const response = await request(app).get('/api/lists');

      expect(response.status).toBe(401);
      expect(response.body.message).toMatch(/missing bearer token/i);
    });
  });

  // ---------------------------------------------------------------
  // getShoppingList — GET /api/lists/:id
  // ---------------------------------------------------------------
  describe('getShoppingList', () => {
    it('happy: 200 with { shoppingList }', async () => {
      vi.spyOn(ShoppingListService.prototype, 'getShoppingListByIdForUser').mockResolvedValue(
        { id: 'g1' } as never,
      );

      const app = createApp();
      const response = await request(app)
        .get('/api/lists/11111111-1111-4111-8111-111111111111')
        .set(bearerAuth());

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ shoppingList: { id: 'g1' } });
    });

    it('error branch: service returns null → 404 { message: "List not found." }', async () => {
      vi.spyOn(ShoppingListService.prototype, 'getShoppingListByIdForUser').mockResolvedValue(
        null as never,
      );

      const app = createApp();
      const response = await request(app)
        .get('/api/lists/missing')
        .set(bearerAuth());

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ message: 'List not found.' });
    });
  });

  // ---------------------------------------------------------------
  // createShoppingList — POST /api/lists
  // ---------------------------------------------------------------
  describe('createShoppingList', () => {
    it('happy: 201 with { shoppingList }', async () => {
      vi.spyOn(ShoppingListService.prototype, 'createShoppingListForUser').mockResolvedValue({
        id: 'g1',
        name: 'Trip',
      } as never);

      const app = createApp();
      const response = await request(app)
        .post('/api/lists')
        .set(bearerAuth())
        .send({ name: 'Trip' });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({ shoppingList: { id: 'g1', name: 'Trip' } });
    });

    it('error branch: missing/blank name → 400 (validation, before service call)', async () => {
      const spy = vi.spyOn(ShoppingListService.prototype, 'createShoppingListForUser');
      const app = createApp();

      const missing = await request(app)
        .post('/api/lists')
        .set(bearerAuth())
        .send({});
      expect(missing.status).toBe(400);
      expect(missing.body).toEqual({ message: 'List name is required.' });

      const blank = await request(app)
        .post('/api/lists')
        .set(bearerAuth())
        .send({ name: '   ' });
      expect(blank.status).toBe(400);
      expect(spy).not.toHaveBeenCalled();
    });

    it('error branch: service throws → 400 with the thrown message', async () => {
      vi.spyOn(ShoppingListService.prototype, 'createShoppingListForUser').mockRejectedValue(
        new Error('boom'),
      );

      const app = createApp();
      const response = await request(app)
        .post('/api/lists')
        .set(bearerAuth())
        .send({ name: 'Trip' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message: 'boom' });
    });
  });

  // ---------------------------------------------------------------
  // updateShoppingList — PATCH /api/lists/:id
  // ---------------------------------------------------------------
  describe('updateShoppingList', () => {
    it('happy: 200 with { shoppingList }', async () => {
      vi.spyOn(ShoppingListService.prototype, 'updateShoppingList').mockResolvedValue({
        id: 'g1',
        name: 'New',
      } as never);

      const app = createApp();
      const response = await request(app)
        .patch('/api/lists/11111111-1111-4111-8111-111111111111')
        .set(bearerAuth())
        .send({ name: 'New' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ shoppingList: { id: 'g1', name: 'New' } });
    });

    it('error branch: missing name → 400 without calling the service', async () => {
      const spy = vi.spyOn(ShoppingListService.prototype, 'updateShoppingList');
      const app = createApp();
      const response = await request(app)
        .patch('/api/lists/11111111-1111-4111-8111-111111111111')
        .set(bearerAuth())
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message: 'List name is required.' });
      expect(spy).not.toHaveBeenCalled();
    });

    it('404-vs-400 discrimination: "not found" → 404, otherwise → 400', async () => {
      vi.spyOn(ShoppingListService.prototype, 'updateShoppingList').mockRejectedValueOnce(
        new Error('List not found.'),
      );
      const app = createApp();

      const notFound = await request(app)
        .patch('/api/lists/11111111-1111-4111-8111-111111111111')
        .set(bearerAuth())
        .send({ name: 'X' });
      expect(notFound.status).toBe(404);

      vi.spyOn(ShoppingListService.prototype, 'updateShoppingList').mockRejectedValueOnce(
        new Error('Bad.'),
      );
      const generic = await request(app)
        .patch('/api/lists/11111111-1111-4111-8111-111111111111')
        .set(bearerAuth())
        .send({ name: 'X' });
      expect(generic.status).toBe(400);
    });
  });

  // ---------------------------------------------------------------
  // addMember — POST /api/lists/:id/members
  // ---------------------------------------------------------------
  describe('addMember', () => {
    it('happy: 201 with { invitation }', async () => {
      vi.spyOn(ShoppingListService.prototype, 'addMemberByEmail').mockResolvedValue({
        id: 'inv1',
      } as never);

      const app = createApp();
      const response = await request(app)
        .post('/api/lists/11111111-1111-4111-8111-111111111111/members')
        .set(bearerAuth())
        .send({ email: 'a@b.com' });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({ invitation: { id: 'inv1' } });
    });

    it('error branch: invalid email → 400 without calling the service', async () => {
      const spy = vi.spyOn(ShoppingListService.prototype, 'addMemberByEmail');
      const app = createApp();
      const response = await request(app)
        .post('/api/lists/11111111-1111-4111-8111-111111111111/members')
        .set(bearerAuth())
        .send({ email: 'not-an-email' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message: 'A valid email is required.' });
      expect(spy).not.toHaveBeenCalled();
    });

    it('404-vs-400 discrimination: "not found" → 404, otherwise → 400', async () => {
      vi.spyOn(
        ShoppingListService.prototype,
        'addMemberByEmail',
      ).mockRejectedValueOnce(new Error('List not found.'));
      const app = createApp();

      const notFound = await request(app)
        .post('/api/lists/11111111-1111-4111-8111-111111111111/members')
        .set(bearerAuth())
        .send({ email: 'a@b.com' });
      expect(notFound.status).toBe(404);

      vi.spyOn(
        ShoppingListService.prototype,
        'addMemberByEmail',
      ).mockRejectedValueOnce(new Error('Already a member.'));
      const generic = await request(app)
        .post('/api/lists/11111111-1111-4111-8111-111111111111/members')
        .set(bearerAuth())
        .send({ email: 'a@b.com' });
      expect(generic.status).toBe(400);
    });
  });

  // ---------------------------------------------------------------
  // removeMember — DELETE /api/lists/:id/members/:userId
  // ---------------------------------------------------------------
  describe('removeMember', () => {
    it('happy: 204 no body', async () => {
      vi.spyOn(ShoppingListService.prototype, 'removeMember').mockResolvedValue(
        undefined as never,
      );

      const app = createApp();
      const response = await request(app)
        .delete('/api/lists/11111111-1111-4111-8111-111111111111/members/44444444-4444-4444-8444-444444444444')
        .set(bearerAuth());

      expect(response.status).toBe(204);
    });

    it('404-vs-400 discrimination: TWO distinct "404" messages ("not found" / "not a member"), else 400', async () => {
      vi.spyOn(ShoppingListService.prototype, 'removeMember').mockRejectedValueOnce(
        new Error('List not found.'),
      );
      const app = createApp();

      const notFound = await request(app)
        .delete('/api/lists/11111111-1111-4111-8111-111111111111/members/44444444-4444-4444-8444-444444444444')
        .set(bearerAuth());
      expect(notFound.status).toBe(404);

      vi.spyOn(ShoppingListService.prototype, 'removeMember').mockRejectedValueOnce(
        new Error('User is not a member.'),
      );
      const notMember = await request(app)
        .delete('/api/lists/11111111-1111-4111-8111-111111111111/members/44444444-4444-4444-8444-444444444444')
        .set(bearerAuth());
      expect(notMember.status).toBe(404);

      vi.spyOn(ShoppingListService.prototype, 'removeMember').mockRejectedValueOnce(
        new Error('Cannot remove owner.'),
      );
      const generic = await request(app)
        .delete('/api/lists/11111111-1111-4111-8111-111111111111/members/44444444-4444-4444-8444-444444444444')
        .set(bearerAuth());
      expect(generic.status).toBe(400);
    });
  });

  // ---------------------------------------------------------------
  // acceptInvitation — POST /api/lists/:id/invitations/:invitationId/accept
  // ---------------------------------------------------------------
  describe('acceptInvitation', () => {
    it('happy: 200 with { invitation }', async () => {
      vi.spyOn(invitationService, 'acceptInvitation').mockResolvedValue({
        id: 'inv1',
      } as never);

      const app = createApp();
      const response = await request(app)
        .post('/api/lists/11111111-1111-4111-8111-111111111111/invitations/55555555-5555-4555-8555-555555555555/accept')
        .set(bearerAuth());

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ invitation: { id: 'inv1' } });
    });

    it('error branch: "not found" → 404, "not the invitee" → 403, else → 400', async () => {
      vi.spyOn(invitationService, 'acceptInvitation').mockRejectedValueOnce(
        new Error('Invitation not found.'),
      );
      const app = createApp();

      const notFound = await request(app)
        .post('/api/lists/11111111-1111-4111-8111-111111111111/invitations/55555555-5555-4555-8555-555555555555/accept')
        .set(bearerAuth());
      expect(notFound.status).toBe(404);

      vi.spyOn(invitationService, 'acceptInvitation').mockRejectedValueOnce(
        new Error('You are not the invitee.'),
      );
      const forbidden = await request(app)
        .post('/api/lists/11111111-1111-4111-8111-111111111111/invitations/55555555-5555-4555-8555-555555555555/accept')
        .set(bearerAuth());
      expect(forbidden.status).toBe(403);

      vi.spyOn(invitationService, 'acceptInvitation').mockRejectedValueOnce(
        new Error('Already accepted.'),
      );
      const generic = await request(app)
        .post('/api/lists/11111111-1111-4111-8111-111111111111/invitations/55555555-5555-4555-8555-555555555555/accept')
        .set(bearerAuth());
      expect(generic.status).toBe(400);
    });
  });

  // ---------------------------------------------------------------
  // declineInvitation — POST /api/lists/:id/invitations/:invitationId/decline
  // ---------------------------------------------------------------
  describe('declineInvitation', () => {
    it('happy: 200 with { invitation }', async () => {
      vi.spyOn(invitationService, 'declineInvitation').mockResolvedValue({
        id: 'inv1',
      } as never);

      const app = createApp();
      const response = await request(app)
        .post('/api/lists/11111111-1111-4111-8111-111111111111/invitations/55555555-5555-4555-8555-555555555555/decline')
        .set(bearerAuth());

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ invitation: { id: 'inv1' } });
    });

    it('error branch: "not found" → 404, "not the invitee" → 403, else → 400', async () => {
      vi.spyOn(invitationService, 'declineInvitation').mockRejectedValueOnce(
        new Error('Invitation not found.'),
      );
      const app = createApp();

      const notFound = await request(app)
        .post('/api/lists/11111111-1111-4111-8111-111111111111/invitations/55555555-5555-4555-8555-555555555555/decline')
        .set(bearerAuth());
      expect(notFound.status).toBe(404);

      vi.spyOn(invitationService, 'declineInvitation').mockRejectedValueOnce(
        new Error('You are not the invitee.'),
      );
      const forbidden = await request(app)
        .post('/api/lists/11111111-1111-4111-8111-111111111111/invitations/55555555-5555-4555-8555-555555555555/decline')
        .set(bearerAuth());
      expect(forbidden.status).toBe(403);

      vi.spyOn(invitationService, 'declineInvitation').mockRejectedValueOnce(
        new Error('Already declined.'),
      );
      const generic = await request(app)
        .post('/api/lists/11111111-1111-4111-8111-111111111111/invitations/55555555-5555-4555-8555-555555555555/decline')
        .set(bearerAuth());
      expect(generic.status).toBe(400);
    });
  });

  // ---------------------------------------------------------------
  // cancelInvitation — DELETE /api/lists/:id/invitations/:invitationId
  // ---------------------------------------------------------------
  describe('cancelInvitation', () => {
    it('happy: 204 no body', async () => {
      vi.spyOn(invitationService, 'cancelInvitation').mockResolvedValue(
        undefined as never,
      );

      const app = createApp();
      const response = await request(app)
        .delete('/api/lists/11111111-1111-4111-8111-111111111111/invitations/55555555-5555-4555-8555-555555555555')
        .set(bearerAuth());

      expect(response.status).toBe(204);
    });

    it('error branch: "not found" → 404, "not the inviter" → 403, else → 400', async () => {
      vi.spyOn(invitationService, 'cancelInvitation').mockRejectedValueOnce(
        new Error('Invitation not found.'),
      );
      const app = createApp();

      const notFound = await request(app)
        .delete('/api/lists/11111111-1111-4111-8111-111111111111/invitations/55555555-5555-4555-8555-555555555555')
        .set(bearerAuth());
      expect(notFound.status).toBe(404);

      vi.spyOn(invitationService, 'cancelInvitation').mockRejectedValueOnce(
        new Error('You are not the inviter.'),
      );
      const forbidden = await request(app)
        .delete('/api/lists/11111111-1111-4111-8111-111111111111/invitations/55555555-5555-4555-8555-555555555555')
        .set(bearerAuth());
      expect(forbidden.status).toBe(403);

      vi.spyOn(invitationService, 'cancelInvitation').mockRejectedValueOnce(
        new Error('Already cancelled.'),
      );
      const generic = await request(app)
        .delete('/api/lists/11111111-1111-4111-8111-111111111111/invitations/55555555-5555-4555-8555-555555555555')
        .set(bearerAuth());
      expect(generic.status).toBe(400);
    });
  });

  // ---------------------------------------------------------------
  // updateShoppingListImage — POST /api/lists/:id/image
  // ---------------------------------------------------------------
  describe('updateShoppingListImage', () => {
    it('happy: 200 with { shoppingList }', async () => {
      vi.mocked(normalizeToDataUrl).mockResolvedValue(
        'data:image/png;base64,AAA',
      );
      vi.spyOn(ShoppingListService.prototype, 'updateShoppingListImage').mockResolvedValue({
        id: 'g1',
        imageUrl: 'data:image/png;base64,AAA',
      } as never);

      const app = createApp();
      const response = await request(app)
        .post('/api/lists/11111111-1111-4111-8111-111111111111/image')
        .set(bearerAuth())
        .attach('image', Buffer.from('fake-png-bytes'), {
          filename: 'a.png',
          contentType: 'image/png',
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        shoppingList: { id: 'g1', imageUrl: 'data:image/png;base64,AAA' },
      });
    });

    it('error branch: no file attached → 400 without calling the service', async () => {
      const spy = vi.spyOn(ShoppingListService.prototype, 'updateShoppingListImage');
      const app = createApp();
      const response = await request(app)
        .post('/api/lists/11111111-1111-4111-8111-111111111111/image')
        .set(bearerAuth());

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message: 'Image file is required.' });
      expect(spy).not.toHaveBeenCalled();
    });

    it('error branch: UnsupportedImageTypeError from normalizeToDataUrl → 415', async () => {
      vi.mocked(normalizeToDataUrl).mockRejectedValue(
        new UnsupportedImageTypeError('image/gif'),
      );

      const app = createApp();
      const response = await request(app)
        .post('/api/lists/11111111-1111-4111-8111-111111111111/image')
        .set(bearerAuth())
        .attach('image', Buffer.from('fake-png-bytes'), {
          filename: 'a.png',
          contentType: 'image/png',
        });

      expect(response.status).toBe(415);
    });

    it('error branch: sharp decode failure message → 422 { message: "Invalid image file." }', async () => {
      vi.mocked(normalizeToDataUrl).mockRejectedValue(
        new Error('Input buffer contains unsupported image format'),
      );

      const app = createApp();
      const response = await request(app)
        .post('/api/lists/11111111-1111-4111-8111-111111111111/image')
        .set(bearerAuth())
        .attach('image', Buffer.from('fake-png-bytes'), {
          filename: 'a.png',
          contentType: 'image/png',
        });

      expect(response.status).toBe(422);
      expect(response.body).toEqual({ message: 'Invalid image file.' });
    });

    it('404-vs-400 discrimination on the list-service call: "not found" → 404, otherwise → 400', async () => {
      vi.mocked(normalizeToDataUrl).mockResolvedValue(
        'data:image/png;base64,AAA',
      );
      vi.spyOn(
        ShoppingListService.prototype,
        'updateShoppingListImage',
      ).mockRejectedValueOnce(new Error('List not found.'));
      const app = createApp();

      const notFound = await request(app)
        .post('/api/lists/11111111-1111-4111-8111-111111111111/image')
        .set(bearerAuth())
        .attach('image', Buffer.from('fake-png-bytes'), {
          filename: 'a.png',
          contentType: 'image/png',
        });
      expect(notFound.status).toBe(404);

      vi.spyOn(
        ShoppingListService.prototype,
        'updateShoppingListImage',
      ).mockRejectedValueOnce(new Error('Not an owner.'));
      const generic = await request(app)
        .post('/api/lists/11111111-1111-4111-8111-111111111111/image')
        .set(bearerAuth())
        .attach('image', Buffer.from('fake-png-bytes'), {
          filename: 'a.png',
          contentType: 'image/png',
        });
      expect(generic.status).toBe(400);
    });
  });
  // ---------------------------------------------------------------
  // requireUuidParams — every list route with a path id
  // ---------------------------------------------------------------
  describe('malformed path ids', () => {
    it.each([
      ['get', '/api/lists/abc', 'List not found.'],
      ['patch', '/api/lists/abc', 'List not found.'],
      ['post', '/api/lists/11111111-1111-4111-8111-111111111111/invitations/abc/accept', 'Invitation not found.'],
      ['delete', '/api/lists/11111111-1111-4111-8111-111111111111/members/abc', 'User is not a member of this list.'],
    ] as const)('%s %s → 404 JSON without reaching the service', async (method, path, message) => {
      const spy = vi.spyOn(ShoppingListService.prototype, 'getShoppingListByIdForUser');
      const app = createApp();
      const response = await request(app)[method](path).set(bearerAuth()).send({});

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ message });
      expect(spy).not.toHaveBeenCalled();
    });

    it('an unexpected service failure is a 500 JSON error, never an HTML stack trace', async () => {
      vi.spyOn(ShoppingListService.prototype, 'getShoppingListByIdForUser').mockRejectedValue(
        new Error('connection terminated'),
      );
      vi.spyOn(console, 'error').mockImplementation(() => undefined);

      const app = createApp();
      const response = await request(app)
        .get('/api/lists/11111111-1111-4111-8111-111111111111')
        .set(bearerAuth());

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ message: 'Internal server error.' });
    });

    it('an unauthenticated caller gets 401 before the id shape is looked at', async () => {
      const app = createApp();
      const response = await request(app).get('/api/lists/abc');

      expect(response.status).toBe(401);
    });
  });
});
