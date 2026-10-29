import { afterEach, describe, expect, it, vi } from 'vitest';

import type { RouteLocationNormalized } from 'vue-router';

import {
  clearLastListId,
  lastListRedirect,
  listIdOf,
  readLastListId,
  saveLastListId,
} from '@/lib/lastList';

const route = (fields: Partial<RouteLocationNormalized>) =>
  ({ params: {}, ...fields }) as RouteLocationNormalized;

const launch = route({ name: 'shoppingLists', path: '/lists', redirectedFrom: { path: '/' } as never });

describe('lastList', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('saves, reads and clears the last list per user', () => {
    saveLastListId('user-1', 'list-1');
    saveLastListId('user-2', 'list-2');

    expect(readLastListId('user-1')).toBe('list-1');
    expect(readLastListId('user-2')).toBe('list-2');

    clearLastListId('user-1');
    expect(readLastListId('user-1')).toBeNull();
    expect(readLastListId('user-2')).toBe('list-2');
  });

  it('treats a throwing storage as empty', () => {
    const blocked = () => {
      throw new Error('blocked');
    };
    vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked, removeItem: blocked });

    expect(() => saveLastListId('user-1', 'list-1')).not.toThrow();
    expect(readLastListId('user-1')).toBeNull();
    expect(() => clearLastListId('user-1')).not.toThrow();
  });

  it('reads the list id from list section routes only', () => {
    expect(listIdOf(route({ name: 'list-week', params: { id: 'list-1' } }))).toBe('list-1');
    expect(listIdOf(route({ name: 'list-dish', params: { id: 'list-1', dishId: 'd' } }))).toBe('list-1');
    expect(listIdOf(route({ name: 'shoppingLists' }))).toBeNull();
    expect(listIdOf(route({ name: 'account' }))).toBeNull();
  });

  it('reopens the last list when the app launches on the root URL', () => {
    saveLastListId('user-1', 'list-1');

    expect(lastListRedirect(launch, 'user-1')).toEqual({
      name: 'list-detail',
      params: { id: 'list-1' },
      state: { restoredLastList: true },
    });
  });

  it('stays on My lists when no list is remembered or nobody is signed in', () => {
    expect(lastListRedirect(launch, 'user-1')).toBeNull();
    saveLastListId('user-1', 'list-1');
    expect(lastListRedirect(launch, undefined)).toBeNull();
  });

  it('never redirects a direct navigation to /lists', () => {
    saveLastListId('user-1', 'list-1');

    expect(lastListRedirect(route({ name: 'shoppingLists', path: '/lists' }), 'user-1')).toBeNull();
  });
});
