/**
 * Guarded `localStorage` JSON access for the offline copies and the outbox
 * (ADR-0030). Storage may be missing (happy-dom, SSR) or throw (private mode,
 * blocked site data, a full quota); the app must keep working without it, so
 * every access swallows the failure, as `lib/lastList.ts` does.
 */
const storage = (): Storage | null =>
  typeof globalThis !== 'undefined' && globalThis.localStorage ? globalThis.localStorage : null;

export function readJson<T>(key: string): T | null {
  try {
    const raw = storage()?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/** Returns whether the value was stored. */
export function writeJson(key: string, value: unknown): boolean {
  try {
    const store = storage();
    if (!store) return false;
    store.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeKey(key: string): void {
  try {
    storage()?.removeItem(key);
  } catch {
    // Nothing to clean up when storage is unavailable.
  }
}

export function removeKeysWithPrefix(prefix: string): void {
  try {
    const store = storage();
    if (!store) return;
    const keys: string[] = [];
    for (let index = 0; index < store.length; index += 1) {
      const key = store.key(index);
      if (key?.startsWith(prefix)) keys.push(key);
    }
    keys.forEach((key) => store.removeItem(key));
  } catch {
    // See removeKey.
  }
}
