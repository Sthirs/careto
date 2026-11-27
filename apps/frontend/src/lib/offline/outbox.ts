import { ref } from 'vue';

import { getAccessToken } from '@/lib/authToken';
import type { ListItem } from '@/types/listItem';

import { isTransientFailure, statusOf } from './networkErrors';
import {
  afterDropped,
  afterSent,
  isTempId,
  randomId,
  sendOp,
  targetOf,
  type NewOutboxOp,
  type OutboxOp,
} from './outboxOps';
import { readJson, removeKey, writeJson } from './storage';

export type { NewOutboxOp, OutboxOp } from './outboxOps';

/**
 * The outbox of list-item changes (ADR-0030). Every add, status change and
 * removal goes through it, online or not: it is saved per user so it outlives
 * a reload, and sent one op at a time, in order. A transient failure keeps the
 * op and retries with backoff; a refusal drops it and tells the listeners.
 */
export type SyncState = 'idle' | 'syncing' | 'waiting';

export type OutboxEvent =
  | { type: 'synced'; op: OutboxOp; item: ListItem | null }
  | { type: 'rejected'; op: OutboxOp; status: number | undefined }
  /** Another tab changed the outbox; the view should reload from the server. */
  | { type: 'changedElsewhere' };

export const RETRY_BASE_MS = 2_000;
export const RETRY_MAX_MS = 30_000;
const OUTBOX_LOCK = 'careto.outbox';

/** Waiting ops of the signed-in user, oldest first. */
export const pendingOps = ref<OutboxOp[]>([]);
export const syncState = ref<SyncState>('idle');

const keyFor = (userId: string) => `careto.outbox.${userId}`;
const listeners = new Set<(event: OutboxEvent) => void>();

let userId: string | null = null;
/** Set once a write failed, so a stale stored copy never replaces memory. */
let storageBroken = false;
let failures = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let running: Promise<void> | null = null;
let runAgain = false;
let triggersWired = false;

const emit = (event: OutboxEvent) => listeners.forEach((listener) => listener(event));

/** Picks up what another tab may have written since. */
const adopt = () => {
  if (!userId || storageBroken) return;
  const stored = readJson<OutboxOp[]>(keyFor(userId));
  if (stored) pendingOps.value = stored;
};

const write = (ops: OutboxOp[]) => {
  pendingOps.value = ops;
  if (userId && !writeJson(keyFor(userId), ops)) storageBroken = true;
};

const clearRetry = () => {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
};

const waitAndRetry = () => {
  syncState.value = 'waiting';
  clearRetry();
  const delay = Math.min(RETRY_BASE_MS * 2 ** failures, RETRY_MAX_MS);
  failures += 1;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void flush();
  }, delay);
};

const browserIsOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

/** Two tabs must never send the same op; without Web Locks, serialize in-tab only. */
const withLock = (run: () => Promise<void>): Promise<void> => {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  if (!locks?.request) return run();
  return locks.request(OUTBOX_LOCK, run) as Promise<void>;
};

const settle = (next: OutboxOp[], event: OutboxEvent) => {
  write(next);
  emit(event);
};

async function drain(): Promise<void> {
  clearRetry();
  adopt();
  while (pendingOps.value.length > 0) {
    // Signed out: keep everything until the same user signs in again.
    if (!getAccessToken()) return;
    if (browserIsOffline()) return waitAndRetry();

    const op = pendingOps.value[0];
    const target = targetOf(op);
    if (target && isTempId(target)) {
      // Its add never landed; there is nothing on the server to change.
      write(afterDropped(pendingOps.value, op));
      continue;
    }

    syncState.value = 'syncing';
    try {
      const item = await sendOp(op);
      failures = 0;
      adopt();
      settle(afterSent(pendingOps.value, op, item), { type: 'synced', op, item });
    } catch (error: unknown) {
      const status = statusOf(error);
      adopt();
      if (op.kind === 'remove' && status === 404) {
        // Already gone, maybe removed by this very op before its answer was lost.
        settle(afterSent(pendingOps.value, op, null), { type: 'synced', op, item: null });
      } else if (isTransientFailure(error) || status === 401) {
        // A 401 here means the refresh could not reach the server either.
        return waitAndRetry();
      } else {
        settle(afterDropped(pendingOps.value, op), { type: 'rejected', op, status });
      }
    }
  }
  syncState.value = 'idle';
}

/** Sends the waiting ops. Calls made while a run is going join it and run once more. */
export function flush(): Promise<void> {
  if (running) {
    runAgain = true;
    return running;
  }
  running = (async () => {
    try {
      do {
        runAgain = false;
        await withLock(drain);
        // After a failure the backoff timer decides when to try again.
      } while (runAgain && syncState.value !== 'waiting');
    } finally {
      running = null;
    }
  })();
  return running;
}

/** Resolves once the run in progress, if any, is over. */
export const outboxSettled = (): Promise<void> => running ?? Promise.resolve();

/** Queues a change, stamped with the time of the tap, and starts sending it. */
export function enqueue(change: NewOutboxOp): OutboxOp {
  const op = { ...change, id: randomId(), occurredAt: new Date().toISOString() } as OutboxOp;
  adopt();
  write([...pendingOps.value, op]);
  void flush();
  return op;
}

export function onOutboxEvent(listener: (event: OutboxEvent) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const wireTriggers = () => {
  if (triggersWired || typeof window === 'undefined') return;
  triggersWired = true;
  window.addEventListener('online', () => {
    failures = 0;
    void flush();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && pendingOps.value.length > 0) void flush();
  });
  window.addEventListener('storage', (event) => {
    if (!userId || event.key !== keyFor(userId)) return;
    pendingOps.value = event.newValue ? (JSON.parse(event.newValue) as OutboxOp[]) : [];
    emit({ type: 'changedElsewhere' });
  });
};

/** Loads the outbox of the signed-in user (null: nobody) and starts sending it. */
export function startOutboxSync(nextUserId: string | null): void {
  wireTriggers();
  if (nextUserId !== userId) {
    clearRetry();
    failures = 0;
    storageBroken = false;
    userId = nextUserId;
    pendingOps.value = nextUserId ? (readJson<OutboxOp[]>(keyFor(nextUserId)) ?? []) : [];
    syncState.value = 'idle';
  }
  if (userId && pendingOps.value.length > 0) void flush();
}

/** Signing out drops the user's waiting changes from this device. */
export function clearOutbox(forUserId: string): void {
  removeKey(keyFor(forUserId));
  if (forUserId !== userId) return;
  clearRetry();
  pendingOps.value = [];
  syncState.value = 'idle';
}

/** Test seam: forget everything, including the signed-in user. */
export function resetOutbox(): void {
  clearRetry();
  listeners.clear();
  userId = null;
  storageBroken = false;
  failures = 0;
  running = null;
  runAgain = false;
  pendingOps.value = [];
  syncState.value = 'idle';
}
