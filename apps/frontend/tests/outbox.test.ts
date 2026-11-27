import { AxiosError } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { watch } from 'vue';

vi.mock('@/lib/api', () => ({
  api: { post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import { api } from '@/lib/api';
import {
  clearOutbox,
  enqueue,
  flush,
  onOutboxEvent,
  outboxSettled,
  pendingOps,
  resetOutbox,
  RETRY_BASE_MS,
  startOutboxSync,
  syncState,
  type OutboxEvent,
} from '@/lib/offline/outbox';
import { MAX_SERVER_ERRORS, OUTBOX_MAX_AGE_MS } from '@/lib/offline/outboxLimits';
import type { OutboxOp } from '@/lib/offline/outboxOps';
import type { ListItem } from '@/types/listItem';

const KEY = 'careto.outbox.u1';
const networkError = () => new AxiosError('Network Error', 'ERR_NETWORK');
const httpError = (status: number) =>
  new AxiosError('failed', 'ERR_BAD_REQUEST', undefined, undefined, { status } as never);
const serverItem = (id: string): ListItem =>
  ({ id, status: 'to_buy', catalogItemKey: 'milk' }) as ListItem;
const stored = () => JSON.parse(localStorage.getItem(KEY) ?? 'null') as OutboxOp[] | null;

let events: OutboxEvent[];

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  localStorage.clear();
  localStorage.setItem('careto.auth.token', 'token');
  resetOutbox();
  startOutboxSync('u1');
  events = [];
  onOutboxEvent((event) => events.push(event));
});

afterEach(() => {
  resetOutbox();
  vi.useRealTimers();
});

describe('outbox (ADR-0030)', () => {
  it('sends ops in order with the time of the tap, and empties itself', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { item: serverItem('i9') } });
    vi.mocked(api.patch).mockResolvedValue({ data: { item: serverItem('i9') } });

    const add = enqueue({ kind: 'add', listId: 'l1', tempItemId: 'local:a', input: { catalogItemKey: 'milk' } });
    enqueue({ kind: 'status', listId: 'l1', itemId: 'local:a', status: 'bought' });
    await outboxSettled();

    expect(api.post).toHaveBeenCalledWith('/lists/l1/items', { catalogItemKey: 'milk' }, {
      headers: { 'X-Occurred-At': add.occurredAt },
      timeout: 15_000,
    });
    // The add's real id replaces the temporary one in the later op.
    expect(api.patch).toHaveBeenCalledWith('/lists/l1/items/i9', { status: 'bought' }, expect.any(Object));
    expect(vi.mocked(api.post).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(api.patch).mock.invocationCallOrder[0],
    );
    expect(pendingOps.value).toEqual([]);
    expect(stored()).toEqual([]);
    expect(events.map((event) => event.type)).toEqual(['synced', 'synced']);
    expect(syncState.value).toBe('idle');
  });

  it('keeps ops through a network failure and retries with backoff', async () => {
    vi.mocked(api.delete).mockRejectedValueOnce(networkError()).mockResolvedValue({ data: {} });

    enqueue({ kind: 'remove', listId: 'l1', itemId: 'i1' });
    await outboxSettled();

    expect(syncState.value).toBe('waiting');
    expect(stored()).toHaveLength(1);
    expect(events).toEqual([]);

    await vi.advanceTimersByTimeAsync(RETRY_BASE_MS);
    await outboxSettled();

    expect(api.delete).toHaveBeenCalledTimes(2);
    expect(stored()).toEqual([]);
    expect(syncState.value).toBe('idle');
  });

  it('waits without trying while the browser is offline, and sends on reconnect', async () => {
    const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    vi.mocked(api.delete).mockResolvedValue({ data: {} });

    enqueue({ kind: 'remove', listId: 'l1', itemId: 'i1' });
    await outboxSettled();
    expect(api.delete).not.toHaveBeenCalled();
    expect(syncState.value).toBe('waiting');

    onLine.mockReturnValue(true);
    window.dispatchEvent(new Event('online'));
    await outboxSettled();
    expect(api.delete).toHaveBeenCalledTimes(1);
    expect(pendingOps.value).toEqual([]);
    onLine.mockRestore();
  });

  it('survives a reload: the saved ops are picked up and sent', async () => {
    const occurredAt = new Date(Date.now() - 30 * 60_000).toISOString();
    localStorage.setItem(KEY, JSON.stringify([{ id: 'x', listId: 'l1', occurredAt, kind: 'remove', itemId: 'i1' }]));
    vi.mocked(api.delete).mockResolvedValue({ data: {} });
    resetOutbox();

    startOutboxSync('u1');
    await outboxSettled();

    expect(api.delete).toHaveBeenCalledWith('/lists/l1/items/i1', {
      headers: { 'X-Occurred-At': occurredAt },
      timeout: 15_000,
    });
  });

  it('counts a removal of an item already gone as done', async () => {
    vi.mocked(api.delete).mockRejectedValue(httpError(404));
    enqueue({ kind: 'remove', listId: 'l1', itemId: 'i1' });
    await outboxSettled();
    expect(pendingOps.value).toEqual([]);
    expect(events.map((event) => event.type)).toEqual(['synced']);
  });

  it('drops a refused op, with the later ops of its item', async () => {
    vi.mocked(api.post).mockRejectedValue(httpError(400));
    vi.mocked(api.delete).mockResolvedValue({ data: {} });

    enqueue({ kind: 'add', listId: 'l1', tempItemId: 'local:a', input: { customName: 'x' } });
    enqueue({ kind: 'status', listId: 'l1', itemId: 'local:a', status: 'bought' });
    enqueue({ kind: 'remove', listId: 'l1', itemId: 'i2' });
    await outboxSettled();

    expect(api.patch).not.toHaveBeenCalled();
    expect(api.delete).toHaveBeenCalledTimes(1);
    expect(events).toEqual([
      expect.objectContaining({ type: 'rejected', status: 400 }),
      expect.objectContaining({ type: 'synced' }),
    ]);
    expect(pendingOps.value).toEqual([]);
  });

  it('keeps everything while signed out, and a 401 waits rather than drops', async () => {
    localStorage.removeItem('careto.auth.token');
    enqueue({ kind: 'remove', listId: 'l1', itemId: 'i1' });
    await outboxSettled();
    expect(api.delete).not.toHaveBeenCalled();

    localStorage.setItem('careto.auth.token', 'token');
    vi.mocked(api.delete).mockRejectedValue(httpError(401));
    await flush();
    expect(syncState.value).toBe('waiting');
    expect(stored()).toHaveLength(1);
  });

  it('stores a new op only under the write lock, so another tab\'s op is never overwritten', async () => {
    const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const tails = new Map<string, Promise<unknown>>();
    const locks = {
      request: (name: string, run: () => Promise<unknown>) => {
        const next = (tails.get(name) ?? Promise.resolve()).then(run);
        tails.set(name, next.catch(() => undefined));
        return next;
      },
    };
    Object.defineProperty(navigator, 'locks', { value: locks, configurable: true });
    try {
      // Another tab holds the write lock and stores its op meanwhile.
      let release = () => {};
      const held = new Promise<void>((done) => (release = done));
      void locks.request('careto.outbox.write', () => held);
      const other = { id: 'other', listId: 'l1', occurredAt: new Date().toISOString(), kind: 'remove', itemId: 'i7' };
      localStorage.setItem(KEY, JSON.stringify([other]));

      const mine = enqueue({ kind: 'remove', listId: 'l1', itemId: 'i1' });
      expect(pendingOps.value.map((op) => op.id)).toContain(mine.id);
      expect(stored()!.map((op) => op.id)).toEqual(['other']);

      release();
      await vi.advanceTimersByTimeAsync(0);
      expect(stored()!.map((op) => op.id)).toEqual(['other', mine.id]);
      await outboxSettled();
      expect(pendingOps.value.map((op) => op.id)).toEqual(['other', mine.id]);
    } finally {
      delete (navigator as { locks?: unknown }).locks;
      onLine.mockRestore();
    }
  });

  it('keeps ops it could not store when another tab changes the stored copy', async () => {
    const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    try {
      const mine = enqueue({ kind: 'remove', listId: 'l1', itemId: 'i1' });
      await outboxSettled();

      window.dispatchEvent(new StorageEvent('storage', { key: KEY, newValue: '[]' }));

      expect(pendingOps.value.map((op) => op.id)).toEqual([mine.id]);
      expect(events.map((event) => event.type)).toEqual(['changedElsewhere']);
    } finally {
      setItem.mockRestore();
      onLine.mockRestore();
    }
  });

  it('keeps each user apart and clears on sign-out', () => {
    enqueue({ kind: 'remove', listId: 'l1', itemId: 'i1' });
    startOutboxSync('u2');
    expect(pendingOps.value).toEqual([]);

    startOutboxSync('u1');
    expect(pendingOps.value).toHaveLength(1);

    clearOutbox('u1');
    expect(pendingOps.value).toEqual([]);
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});

describe('outbox retry limits (ADR-0031)', () => {
  const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

  it('drops ops waiting over an hour, with the later ops of an expired add, even offline', async () => {
    const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const old = ago(OUTBOX_MAX_AGE_MS + 60_000);
    localStorage.setItem(
      KEY,
      JSON.stringify([
        { id: 'a', listId: 'l1', occurredAt: old, kind: 'add', tempItemId: 'local:a', input: { catalogItemKey: 'milk' } },
        { id: 'b', listId: 'l1', occurredAt: ago(10 * 60_000), kind: 'status', itemId: 'local:a', status: 'bought' },
        { id: 'c', listId: 'l1', occurredAt: ago(60_000), kind: 'remove', itemId: 'i2' },
      ]),
    );
    resetOutbox();
    onOutboxEvent((event) => events.push(event));
    try {
      startOutboxSync('u1');
      await outboxSettled();

      expect(api.post).not.toHaveBeenCalled();
      expect(events).toEqual([{ type: 'expired', ops: [expect.objectContaining({ id: 'a' }), expect.objectContaining({ id: 'b' })] }]);
      expect(pendingOps.value.map((op) => op.id)).toEqual(['c']);
      expect(stored()!.map((op) => op.id)).toEqual(['c']);
      expect(syncState.value).toBe('waiting');
    } finally {
      onLine.mockRestore();
    }
  });

  it('expires an op that kept failing while waiting', async () => {
    vi.mocked(api.delete).mockRejectedValue(networkError());
    enqueue({ kind: 'remove', listId: 'l1', itemId: 'i1' });
    await outboxSettled();

    await vi.advanceTimersByTimeAsync(OUTBOX_MAX_AGE_MS + 60_000);
    await outboxSettled();

    expect(pendingOps.value).toEqual([]);
    expect(events.map((event) => event.type)).toEqual(['expired']);
  });

  it('drops an op the server keeps failing on, but never counts a request with no answer', async () => {
    vi.mocked(api.delete).mockRejectedValue(networkError());
    enqueue({ kind: 'remove', listId: 'l1', itemId: 'i1' });
    await outboxSettled();
    for (let attempt = 0; attempt < MAX_SERVER_ERRORS + 2; attempt += 1) {
      await vi.advanceTimersByTimeAsync(30_000);
    }
    expect(pendingOps.value).toHaveLength(1);
    expect(events).toEqual([]);

    vi.mocked(api.delete).mockClear().mockRejectedValue(httpError(500));
    for (let attempt = 0; attempt < MAX_SERVER_ERRORS; attempt += 1) {
      await vi.advanceTimersByTimeAsync(30_000);
    }
    await outboxSettled();

    expect(api.delete).toHaveBeenCalledTimes(MAX_SERVER_ERRORS);
    expect(pendingOps.value).toEqual([]);
    expect(events).toEqual([expect.objectContaining({ type: 'rejected', status: 500 })]);
  });

  it('shows the answer and the trimmed queue in the same step', async () => {
    vi.mocked(api.patch).mockResolvedValue({ data: { item: serverItem('i1') } });
    // What a render sees once the op leaves the queue: the answer must be there.
    const answeredWhenEmptied: boolean[] = [];
    const stop = watch(
      () => pendingOps.value.length,
      (length) => {
        if (length === 0) answeredWhenEmptied.push(events.some((event) => event.type === 'synced'));
      },
    );

    enqueue({ kind: 'status', listId: 'l1', itemId: 'i1', status: 'bought' });
    await outboxSettled();
    await vi.advanceTimersByTimeAsync(0);
    stop();

    expect(answeredWhenEmptied).toEqual([true]);
  });

  it('tells which ops another tab took out of the queue', async () => {
    const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    try {
      const sent = enqueue({ kind: 'remove', listId: 'l1', itemId: 'i1' });
      const left = enqueue({ kind: 'remove', listId: 'l1', itemId: 'i2' });
      await outboxSettled();
      await vi.advanceTimersByTimeAsync(0);

      localStorage.setItem(KEY, JSON.stringify([left]));
      window.dispatchEvent(new StorageEvent('storage', { key: KEY, newValue: JSON.stringify([left]) }));

      expect(events).toEqual([{ type: 'changedElsewhere', removed: [sent] }]);
      expect(pendingOps.value.map((op) => op.id)).toEqual([left.id]);
    } finally {
      onLine.mockRestore();
    }
  });

  it('goes back to idle when the session ends between two ops', async () => {
    vi.mocked(api.delete).mockImplementation(async () => {
      localStorage.removeItem('careto.auth.token');
      return { data: {} };
    });
    enqueue({ kind: 'remove', listId: 'l1', itemId: 'i1' });
    enqueue({ kind: 'remove', listId: 'l1', itemId: 'i2' });
    await outboxSettled();

    expect(api.delete).toHaveBeenCalledTimes(1);
    expect(pendingOps.value).toHaveLength(1);
    expect(syncState.value).toBe('idle');
  });
});
