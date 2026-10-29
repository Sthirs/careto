import type { RouteLocationNormalized, RouteLocationRaw } from 'vue-router';

/**
 * The last shopping list the user was viewing, remembered per device and per
 * user so the app can reopen it on launch (docs/specifications.md, Features).
 * Keyed by user id so a shared device never reopens another account's list.
 * Every access is guarded: storage may be missing (SSR / happy-dom) or throw
 * (private mode, blocked site data), and the app must work without it.
 */
const keyFor = (userId: string) => `careto.lastListId.${userId}`;

const storage = (): Storage | null =>
  typeof globalThis !== 'undefined' && globalThis.localStorage ? globalThis.localStorage : null;

export function readLastListId(userId: string): string | null {
  try {
    return storage()?.getItem(keyFor(userId)) ?? null;
  } catch {
    return null;
  }
}

export function saveLastListId(userId: string, listId: string): void {
  try {
    storage()?.setItem(keyFor(userId), listId);
  } catch {
    // Not remembering the list is harmless; the app opens on My lists.
  }
}

export function clearLastListId(userId: string): void {
  try {
    storage()?.removeItem(keyFor(userId));
  } catch {
    // See saveLastListId.
  }
}

/** Every list section route (`list-detail`, `list-week`, …) carries the list id. */
export function listIdOf(route: RouteLocationNormalized): string | null {
  const id = route.params.id;
  return typeof route.name === 'string' && route.name.startsWith('list-') && typeof id === 'string'
    ? id
    : null;
}

/**
 * The redirect marks its history entry with `restoredLastList`, so the list
 * view can tell a remembered list that has since gone (fall back to My lists)
 * from a deep link the user followed (show the load error).
 *
 * Only an app launch — the root URL, which is also the PWA `start_url` —
 * reopens the last list. Navigating to `/lists` directly, or back to it from
 * a list, still shows My lists.
 */
export function lastListRedirect(
  to: RouteLocationNormalized,
  userId: string | undefined,
): RouteLocationRaw | null {
  if (!userId || to.name !== 'shoppingLists' || to.redirectedFrom?.path !== '/') return null;
  const id = readLastListId(userId);
  return id ? { name: 'list-detail', params: { id }, state: { restoredLastList: true } } : null;
}
