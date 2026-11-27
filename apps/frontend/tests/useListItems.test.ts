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
import { resetOutbox } from '@/lib/offline/outbox';
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
});
