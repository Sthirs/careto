import { flushPromises } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ user: { id: 'u1' } }) }));
vi.mock('@/composables/useItemCatalog', async () => {
  const { ref } = await import('vue');
  return { useItemCatalog: () => ({ catalog: ref(null) }) };
});

import { useListItems } from '@/composables/useListItems';
import { api } from '@/lib/api';
import { readListSnapshot } from '@/lib/offline/listSnapshot';
import { enqueue, outboxSettled, pendingOps, resetOutbox, startOutboxSync } from '@/lib/offline/outbox';
import type { ListItem, ListItemsResponse } from '@/types/listItem';

const response = (ids: string[]): { data: ListItemsResponse } => ({
  data: {
    sectionOrder: [],
    items: ids.map((id) => ({ id, status: 'to_buy', catalogItemKey: 'milk' }) as ListItem),
    customItems: [],
    overrides: [],
  },
});

describe('useListItems loads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    resetOutbox();
  });

  it('ignores an older load that answers after a newer one', async () => {
    let answerOld: (value: unknown) => void = () => {};
    vi.mocked(api.get)
      .mockImplementationOnce(() => new Promise((resolve) => (answerOld = resolve)))
      .mockResolvedValueOnce(response(['new']));
    const list = useListItems(() => 'l1');

    const older = list.loadItems();
    await list.loadItems();
    answerOld(response(['old']));
    await older;

    expect(list.items.value.map((item) => item.id)).toEqual(['new']);
    expect(readListSnapshot('u1', 'l1')?.items?.items.map((item) => item.id)).toEqual(['new']);
  });

  it('keeps a change that synced while an older load was in flight', async () => {
    localStorage.setItem('careto.auth.token', 'token');
    startOutboxSync('u1');
    let answerLoad: (value: unknown) => void = () => {};
    // The load was served before the buy landed, but answers after it.
    vi.mocked(api.get)
      .mockImplementationOnce(() => new Promise((resolve) => (answerLoad = resolve)))
      .mockImplementation(async () => ({
        data: { ...response(['i1']).data, items: [{ id: 'i1', status: 'bought', catalogItemKey: 'milk' } as ListItem] },
      }));
    vi.mocked(api.patch).mockResolvedValue({ data: { item: { id: 'i1', status: 'bought', catalogItemKey: 'milk' } } });
    const list = useListItems(() => 'l1');

    const load = list.loadItems();
    enqueue({ kind: 'status', listId: 'l1', itemId: 'i1', status: 'bought' });
    await outboxSettled();
    answerLoad(response(['i1']));
    await load;

    expect(list.items.value.map((item) => item.status)).toEqual(['bought']);
    // And it fetches the final state once more.
    await flushPromises();
    expect(api.get).toHaveBeenCalledTimes(2);
    expect(list.items.value.map((item) => item.status)).toEqual(['bought']);
  });

  it('keeps showing a change another tab sent until the reload has it', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(response(['i1']));
    const list = useListItems(() => 'l1');
    await list.loadItems();

    // Another tab queued and sent a removal of i1.
    const op = { id: 'x', listId: 'l1', occurredAt: new Date().toISOString(), kind: 'remove', itemId: 'i1' };
    startOutboxSync('u1');
    pendingOps.value = [op as never];
    let answerReload: (value: unknown) => void = () => {};
    vi.mocked(api.get).mockImplementationOnce(() => new Promise((resolve) => (answerReload = resolve)));
    localStorage.setItem('careto.outbox.u1', '[]');
    window.dispatchEvent(new StorageEvent('storage', { key: 'careto.outbox.u1', newValue: '[]' }));

    // The queue is empty, but the removal stays shown while the reload runs.
    expect(pendingOps.value).toEqual([]);
    expect(list.items.value).toEqual([]);

    answerReload(response([]));
    await flushPromises();
    expect(list.items.value).toEqual([]);
  });

  it('reloads and says so when changes of the list expired', async () => {
    localStorage.setItem('careto.auth.token', 'token');
    localStorage.setItem(
      'careto.outbox.u1',
      JSON.stringify([
        { id: 'x', listId: 'l1', occurredAt: new Date(Date.now() - 2 * 60 * 60_000).toISOString(), kind: 'remove', itemId: 'i1' },
      ]),
    );
    vi.mocked(api.get).mockResolvedValue(response(['i1']));
    const onExpired = vi.fn();
    useListItems(() => 'l1', { onExpired });

    startOutboxSync('u1');
    await outboxSettled();
    await flushPromises();

    expect(onExpired).toHaveBeenCalledTimes(1);
    expect(api.get).toHaveBeenCalledTimes(1);
    expect(api.delete).not.toHaveBeenCalled();
  });
});
