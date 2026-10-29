import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';

import ShoppingListDetailView from '@/views/ShoppingListDetailView.vue';
import { resetItemCatalogCache } from '@/composables/useItemCatalog';
import { i18n } from '@/i18n';
import { api } from '@/lib/api';
import type { ListItem } from '@/types/listItem';

const CATALOG = {
  sections: [{ key: 'fruits-vegetables' }, { key: 'milk-cheese' }, { key: 'own-items' }],
  items: [
    { key: 'pineapple', sectionKey: 'fruits-vegetables' },
    { key: 'apricot', sectionKey: 'fruits-vegetables' },
    { key: 'milk', sectionKey: 'milk-cheese' },
  ],
};

const listItem = (overrides: Partial<ListItem>): ListItem => ({
  id: 'i1',
  status: 'to_buy',
  source: 'user',
  lastBoughtAt: null,
  catalogItemKey: 'pineapple',
  customItem: null,
  sectionKey: 'fruits-vegetables',
  ...overrides,
});

let itemsPayload: { sectionOrder: string[]; items: ListItem[]; customItems: unknown[] };

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

vi.mock('vue-router', async () => {
  const { defineComponent, h } = await import('vue');
  return {
    RouterLink: defineComponent({
      props: { to: { type: Object, required: true } },
      setup: (_props, { slots }) => () => h('a', slots.default?.()),
    }),
    useRoute: () => ({ params: { id: 'list-1' }, meta: {}, query: {} }),
    useRouter: () => ({ push: vi.fn(), afterEach: () => () => {}, options: { history: { state: {} } } }),
  };
});

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ user: { id: 'u1', displayName: 'Alice', imageUrl: null }, isAuthenticated: true }),
}));

const mountView = async () => {
  const wrapper = mount(ShoppingListDetailView, { global: { plugins: [i18n] }, attachTo: document.body });
  await flushPromises();
  return wrapper;
};

const tileNames = (wrapper: Awaited<ReturnType<typeof mountView>>, tone: string) =>
  wrapper.findAll(`[data-testid="list-item"][data-tone="${tone}"]`).map((tile) => tile.text());

describe('ShoppingListDetailView items', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    resetItemCatalogCache();
    Object.defineProperty(window, 'history', { value: { state: {} }, writable: true, configurable: true });
    itemsPayload = {
      sectionOrder: ['milk-cheese', 'fruits-vegetables', 'own-items'],
      items: [
        listItem({ id: 'i1' }),
        listItem({ id: 'i2', catalogItemKey: 'milk', sectionKey: 'milk-cheese' }),
        listItem({ id: 'i3', catalogItemKey: 'apricot', status: 'bought', lastBoughtAt: '2026-10-24T10:00:00Z' }),
        listItem({ id: 'i4', catalogItemKey: null, customItem: { id: 'c1', name: "Nonna's sauce" }, sectionKey: 'own-items' }),
      ],
      customItems: [{ id: 'c1', name: "Nonna's sauce" }],
    };
    vi.mocked(api.get).mockImplementation(((url: string) => {
      if (url === '/catalog') return Promise.resolve({ data: CATALOG });
      if (url.endsWith('/items')) return Promise.resolve({ data: itemsPayload });
      return Promise.resolve({ data: { shoppingList: { id: 'list-1', name: 'Home', members: [], pendingInvitations: [] } } });
    }) as typeof api.get);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('shows to-buy items in the list section order and bought ones under Last used', async () => {
    const wrapper = await mountView();

    expect(tileNames(wrapper, 'to-buy')).toEqual(['Milk', 'Pineapple', "Nonna's sauce"]);
    expect(tileNames(wrapper, 'bought')).toEqual(['Apricot']);
    expect(wrapper.find('[data-testid="list-empty"]').exists()).toBe(false);
  });

  it('marks items to buy because of a dish with the dish badge', async () => {
    itemsPayload.items[0] = listItem({ id: 'i1', source: 'dish' });
    const wrapper = await mountView();

    const badged = wrapper
      .findAll('[data-testid="list-item"][data-tone="to-buy"]')
      .filter((tile) => tile.find('[data-testid="from-dish-badge"]').exists())
      .map((tile) => tile.text());
    expect(badged).toEqual(['Pineapple']);
    expect(wrapper.find('[data-testid="from-dish-badge"]').attributes('aria-label')).toBe('For a dish');
  });

  it('marks an item bought on tap and puts it back from Last used', async () => {
    vi.mocked(api.patch).mockImplementation(((url: string, body: { status: string }) =>
      Promise.resolve({ data: { item: listItem({ id: url.split('/').pop(), status: body.status as ListItem['status'], catalogItemKey: url.endsWith('i2') ? 'milk' : 'apricot', sectionKey: url.endsWith('i2') ? 'milk-cheese' : 'fruits-vegetables', lastBoughtAt: '2026-10-25T10:00:00Z' }) } })) as typeof api.patch);
    const wrapper = await mountView();

    await wrapper.find('button[aria-label="Mark Milk as bought"]').trigger('click');
    await flushPromises();
    expect(api.patch).toHaveBeenCalledWith('/lists/list-1/items/i2', { status: 'bought' });
    expect(tileNames(wrapper, 'bought')).toContain('Milk');

    await wrapper.find('button[aria-label="Add Apricot back to the list"]').trigger('click');
    await flushPromises();
    expect(api.patch).toHaveBeenCalledWith('/lists/list-1/items/i3', { status: 'to_buy' });
    expect(tileNames(wrapper, 'to-buy')).toContain('Apricot');
  });

  it('searches catalog and custom items and adds a result', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { item: listItem({ id: 'i9', catalogItemKey: 'apricot', status: 'to_buy' }) } });
    const wrapper = await mountView();

    await wrapper.find('#item-search').setValue('a');
    const labels = wrapper.findAll('[data-testid="search-result"]').map((r) => r.attributes('aria-label'));
    expect(labels).toContain('Add Apricot');
    expect(labels).toContain('Pineapple is already in the list');
    expect(labels).toContain("Nonna's sauce is already in the list");
    expect(labels.at(-1)).toBe('Add a as a custom item');

    await wrapper.find('button[aria-label="Add Apricot"]').trigger('click');
    await flushPromises();
    expect(api.post).toHaveBeenCalledWith('/lists/list-1/items', { catalogItemKey: 'apricot' });
    expect((wrapper.find('#item-search').element as HTMLInputElement).value).toBe('');
    expect(tileNames(wrapper, 'to-buy')).toContain('Apricot');
  });

  it('adds what was typed as a custom item', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: { item: listItem({ id: 'i9', catalogItemKey: null, customItem: { id: 'c2', name: 'Oat drink' }, sectionKey: 'own-items' }) },
    });
    const wrapper = await mountView();

    await wrapper.find('#item-search').setValue('Oat drink');
    expect(wrapper.text()).toContain('No matches — add it anyway');
    await wrapper.find('button[aria-label="Add Oat drink as a custom item"]').trigger('click');
    await flushPromises();

    expect(api.post).toHaveBeenCalledWith('/lists/list-1/items', { customName: 'Oat drink' });
    expect(tileNames(wrapper, 'to-buy')).toContain('Oat drink');
  });

  it('removes an item with the Delete key', async () => {
    vi.mocked(api.delete).mockResolvedValue({ data: {} });
    const wrapper = await mountView();

    await wrapper.find('button[aria-label="Mark Milk as bought"]').trigger('keydown', { key: 'Delete' });
    await flushPromises();

    expect(api.delete).toHaveBeenCalledWith('/lists/list-1/items/i2');
    expect(tileNames(wrapper, 'to-buy')).not.toContain('Milk');
  });

  it('removes an item swiped far enough left, and keeps one swiped a little', async () => {
    vi.mocked(api.delete).mockResolvedValue({ data: {} });
    const width = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(300);
    const wrapper = await mountView();
    const swipe = async (index: number, dx: number) => {
      const tile = wrapper.findAll('[data-testid="list-item"][data-tone="to-buy"]')[index];
      await tile.trigger('pointerdown', { pointerId: 1, clientX: 280, clientY: 10, pointerType: 'touch' });
      await tile.trigger('pointermove', { pointerId: 1, clientX: 280 + dx, clientY: 12, pointerType: 'touch' });
      await tile.trigger('pointerup', { pointerId: 1, clientX: 280 + dx, clientY: 12, pointerType: 'touch' });
      await flushPromises();
    };

    await swipe(0, -40);
    expect(api.delete).not.toHaveBeenCalled();

    await swipe(0, -200);
    expect(api.delete).toHaveBeenCalledWith('/lists/list-1/items/i2');
    expect(tileNames(wrapper, 'to-buy')).toEqual(['Pineapple', "Nonna's sauce"]);
    width.mockRestore();
  });

  it('restores the item and shows an error when the update fails', async () => {
    vi.mocked(api.patch).mockRejectedValue(new Error('offline'));
    const wrapper = await mountView();

    await wrapper.find('button[aria-label="Mark Milk as bought"]').trigger('click');
    await flushPromises();

    expect(tileNames(wrapper, 'to-buy')).toContain('Milk');
    expect(wrapper.find('[role="alert"]').text()).toBe('We could not update the list. Try again.');
  });
});
