/**
 * The access-token storage key (ADR-0018).
 *
 * The key's VALUE is a cross-module contract, not an implementation detail:
 * `lib/appVersion.ts` relies on the deploy purge not touching it (ADR-0016's
 * "keeping the user signed in"), and `tests/e2e/fixtures/auth.ts` writes it
 * directly into a Playwright storageState. Changing the string would sign every
 * user out on the next deploy and break the whole e2e suite.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  ACCESS_TOKEN_KEY,
  clearAccessToken,
  getAccessToken,
  setAccessToken,
} from '@/lib/authToken';

const memStore: Record<string, string> = {};

beforeEach(() => {
  for (const key of Object.keys(memStore)) delete memStore[key];
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (k in memStore ? memStore[k] : null),
    setItem: (k: string, v: string) => {
      memStore[k] = String(v);
    },
    removeItem: (k: string) => {
      delete memStore[k];
    },
    clear: () => undefined,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('authToken', () => {
  it('uses the exact key other modules and the e2e fixture depend on', () => {
    expect(ACCESS_TOKEN_KEY).toBe('careto.auth.token');
  });

  it('returns null when nothing is stored', () => {
    expect(getAccessToken()).toBeNull();
  });

  it('round-trips a token through storage under that key', () => {
    setAccessToken('a-token');

    expect(memStore['careto.auth.token']).toBe('a-token');
    expect(getAccessToken()).toBe('a-token');
  });

  it('clears the token', () => {
    setAccessToken('a-token');
    clearAccessToken();

    expect(getAccessToken()).toBeNull();
  });

  it('stores no refresh token — that credential is an httpOnly cookie', () => {
    setAccessToken('a-token');

    expect(Object.keys(memStore)).toEqual(['careto.auth.token']);
  });
});
