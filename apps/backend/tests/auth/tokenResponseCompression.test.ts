/**
 * BREACH guard (ADR-0028): the real token-issuing routes must never be
 * compressed, however the path is cased and however large the body is. The
 * user carries a large `imageUrl` data URL (ADR-0015), so every body here is
 * well over the 1 KB compression threshold; a non-token route returning the
 * same user is the control that proves compression is otherwise active.
 */
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rotateRefreshToken } = vi.hoisted(() => ({ rotateRefreshToken: vi.fn() }));

vi.mock('../../src/services/refreshTokenService', () => ({
  rotateRefreshToken,
  revokeFamilyByRawToken: vi.fn(async () => undefined),
  issueRefreshToken: vi.fn(async () => ({
    raw: 'issued-raw',
    expiresAt: new Date(Date.now() + 1000),
  })),
  pruneExpiredRefreshTokens: vi.fn(async () => 0),
}));

vi.mock('../../src/db/data-source', () => ({
  AppDataSource: {
    getRepository: vi.fn(() => ({})),
    transaction: vi.fn(),
    manager: { getRepository: () => ({}) },
  },
  initializeDatabase: vi.fn(async () => undefined),
}));

// Registration is off when unset (ADR-0005); env.ts parses at import time.
vi.hoisted(() => {
  process.env.AUTH_LOCAL_REGISTRATION_ENABLED = 'true';
});

import { createApp } from '../../src/app';
import type { User } from '../../src/entities/User';
import { AuthService } from '../../src/services/authService';

const JWT_SECRET = 'change-me-in-real-environments';
const USER = {
  id: 'u1',
  email: 'u@careto.local',
  displayName: 'Demo',
  language: 'en',
  imageUrl: `data:image/png;base64,${'A'.repeat(8000)}`,
  passwordHash: 'hashed',
} as unknown as User;

const app = createApp();
const ACCEPT = 'br, gzip, deflate';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(AuthService.prototype, 'login').mockResolvedValue(USER);
  vi.spyOn(AuthService.prototype, 'register').mockResolvedValue(USER);
  vi.spyOn(AuthService.prototype, 'findById').mockResolvedValue(USER);
  rotateRefreshToken.mockResolvedValue({
    kind: 'rotated',
    userId: 'u1',
    raw: 'successor-secret',
    expiresAt: new Date(Date.now() + 1000),
  });
});

const expectUncompressedToken = (response: request.Response) => {
  expect(response.headers['content-encoding']).toBeUndefined();
  expect(response.headers['cache-control']).toBe('no-store, no-transform');
  expect(response.body.token).toEqual(expect.any(String));
  expect(response.body.user.imageUrl).toBe(USER.imageUrl);
};

describe('token-issuing responses are never compressed', () => {
  it.each(['/api/auth/login', '/API/Auth/Login'])('POST %s', async (path) => {
    const response = await request(app)
      .post(path)
      .set('accept-encoding', ACCEPT)
      .send({ email: USER.email, password: 'secret-password' });

    expect(response.status).toBe(200);
    expectUncompressedToken(response);
  });

  it.each(['/api/auth/register', '/api/AUTH/register'])('POST %s', async (path) => {
    const response = await request(app)
      .post(path)
      .set('accept-encoding', ACCEPT)
      .send({ email: USER.email, password: 'secret-password', displayName: 'Demo' });

    expect(response.status).toBe(201);
    expectUncompressedToken(response);
  });

  it.each(['/api/auth/session/refresh', '/api/auth/SESSION/refresh'])('POST %s', async (path) => {
    const response = await request(app)
      .post(path)
      .set('accept-encoding', ACCEPT)
      .set('Cookie', 'careto.auth.refresh=raw-secret');

    expect(response.status).toBe(200);
    expectUncompressedToken(response);
  });

  it('still compresses a large non-token response for the same user', async () => {
    const token = jwt.sign({ userId: USER.id, email: USER.email }, JWT_SECRET);
    const response = await request(app)
      .get('/api/auth/me')
      .set('accept-encoding', ACCEPT)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.headers['content-encoding']).toBe('br');
  });
});
