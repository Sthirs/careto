import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';

import ShoppingListDetailView from '@/views/ShoppingListDetailView.vue';
import { resetItemCatalogCache } from '@/composables/useItemCatalog';
import { i18n } from '@/i18n';
import { api } from '@/lib/api';
import type { ListItem } from '@/types/listItem';

const route = vi.hoisted(() => ({ value: null as unknown as { query: Record<string, string> } }));

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

// The sheet lives in `?overlay=` (ADR-0019): a reactive route lets it open.
vi.mock('vue-router', async () => {
  const { defineComponent, h, reactive } = await import('vue');
  route.value = reactive({ params: { id: 'list-1' }, meta: {}, query: {}, path: '/lists/list-1' });
  const go = (target: { query: Record<string, string> }) => {
    route.value.query = { ...target.query };
    return Promise.resolve();
  };
  return {
    RouterLink: defineComponent({ setup: (_p, { slots }) => () => h('a', slots.default?.()) }),
    useRoute: () => route.value,
    useRouter: () => ({
      push: go,
      replace: go,
      resolve: () => ({ fullPath: '' }),
      afterEach: () => () => {},
      options: { history: { state: {} } },
    }),
  };
});

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ user: { id: 'u1', displayName: 'Alice', imageUrl: null }, isAuthenticated: true }),
}));

const CATALOG = {
  sections: [{ key: 'milk-cheese' }, { key: 'beverages' }, { key: 'own-items' }],
  items: [
    { key: 'milk', sectionKey: 'milk-cheese' },
    { key: 'coffee', sectionKey: 'beverages' },
  ],
};

const listItem = (overrides: Partial<ListItem>): ListItem => ({
  id: 'i1',
  status: 'to_buy',
  source: 'user',
  lastBoughtAt: null,
  catalogItemKey: 'milk',
  customItem: null,
  sectionKey: 'milk-cheese',
  defaultSectionKey: 'milk-cheese',
  iconKey: null,
  ...overrides,
});

const KOMBUCHA = listItem({
  id: 'i2',
  catalogItemKey: null,
  customItem: { id: 'c1', name: 'Kombucha' },
  sectionKey: 'own-items',
  defaultSectionKey: 'own-items',
});

const body = () => document.body;
const button = (name: string) =>
  Array.from(body().querySelectorAll('button')).find(
    (candidate) => candidate.getAttribute('aria-label') === name || candidate.textContent?.trim().startsWith(name),
  ) as HTMLButtonElement;
const toBuyNames = () =>
  Array.from(body().querySelectorAll('[data-testid="list-item"][data-tone="to-buy"]')).map((tile) =>
    tile.textContent?.trim(),
  );

let mounted: { unmount: () => void } | null = null;

const mountView = async () => {
  const wrapper = mount(ShoppingListDetailView, { global: { plugins: [i18n] }, attachTo: document.body });
  mounted = wrapper;
  await flushPromises();
  return wrapper;
};

const openMenu = async (name: string) => {
  button(`More options for ${name}`).click();
  await flushPromises();
};

describe('list item ⋮ menu', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    resetItemCatalogCache();
    route.value.query = {};
    Object.defineProperty(window, 'history', { value: { state: {} }, writable: true, configurable: true });
    vi.mocked(api.get).mockImplementation(((url: string) => {
      if (url === '/catalog') return Promise.resolve({ data: CATALOG });
      if (url.endsWith('/items')) {
        return Promise.resolve({
          data: { sectionOrder: ['milk-cheese', 'beverages', 'own-items'], items: [listItem({}), KOMBUCHA], customItems: [] },
        });
      }
      return Promise.resolve({ data: { shoppingList: { id: 'list-1', name: 'Home', members: [], pendingInvitations: [] } } });
    }) as typeof api.get);
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
    document.body.innerHTML = '';
  });

  it('opens with the item, its kind and its section', async () => {
    await mountView();
    await openMenu('Kombucha');

    const menu = body().querySelector('[data-testid="item-menu"]');
    expect(route.value.query.overlay).toBe('item-menu');
    expect(menu?.textContent).toContain('Kombucha');
    expect(menu?.textContent).toContain('Custom item');
    expect(menu?.textContent).toContain('Not sorted yet');
  });

  it('opens on the first tap after a swipe that snapped back', async () => {
    const wrapper = await mountView();
    const tile = wrapper.findAll('[data-testid="list-item"]').find((candidate) => candidate.text().includes('Kombucha'))!;
    await tile.trigger('pointerdown', { pointerId: 1, clientX: 280, clientY: 10, pointerType: 'touch' });
    await tile.trigger('pointermove', { pointerId: 1, clientX: 240, clientY: 12, pointerType: 'touch' });
    await tile.trigger('pointerup', { pointerId: 1, clientX: 240, clientY: 12, pointerType: 'touch' });
    // The click that ends the swipe goes to the captured <li>, not to a button.
    await tile.trigger('click');

    await tile.trigger('pointerdown', { pointerId: 2, clientX: 300, clientY: 10, pointerType: 'touch' });
    await tile.trigger('pointerup', { pointerId: 2, clientX: 300, clientY: 10, pointerType: 'touch' });
    await openMenu('Kombucha');

    expect(body().querySelector('[data-testid="item-menu"]')?.textContent).toContain('Kombucha');
  });

  it('removes the item from the list', async () => {
    vi.mocked(api.delete).mockResolvedValue({ data: {} });
    await mountView();
    await openMenu('Milk');

    button('Remove from list').click();
    await flushPromises();

    expect(api.delete).toHaveBeenCalledWith('/lists/list-1/items/i1');
    expect(toBuyNames()).toEqual(['Kombucha']);
    expect(route.value.query.overlay).toBeUndefined();
  });

  it('searches and saves another icon', async () => {
    vi.mocked(api.patch).mockResolvedValue({ data: { item: listItem({ iconKey: 'coffee' }) } });
    await mountView();
    await openMenu('Milk');

    button('Change icon').click();
    await flushPromises();
    const search = body().querySelector<HTMLInputElement>('#item-icon-search');
    search!.value = 'zzz';
    search!.dispatchEvent(new Event('input'));
    await flushPromises();
    expect(body().textContent).toContain('No icons match “zzz”');

    search!.value = 'coff';
    search!.dispatchEvent(new Event('input'));
    await flushPromises();
    const choices = Array.from(body().querySelectorAll<HTMLButtonElement>('[data-testid="icon-choice"]'));
    expect(choices.every((choice) => choice.title.toLowerCase().includes('coff'))).toBe(true);
    choices.find((choice) => choice.title === 'Coffee')!.click();
    await flushPromises();
    const pressed = body().querySelectorAll<HTMLButtonElement>('[data-testid="icon-choice"][aria-pressed="true"]');
    expect(Array.from(pressed, (choice) => choice.title)).toEqual(['Coffee']);
    button('Save icon').click();
    await flushPromises();

    expect(api.patch).toHaveBeenCalledWith('/lists/list-1/items/i1', { iconKey: 'coffee' });
    // The sheet goes back to the item's actions instead of closing.
    expect(route.value.query.overlay).toBe('item-menu');
    expect(body().querySelector('[data-testid="item-menu"]')).not.toBeNull();
  });

  it('goes back to the actions when a picker is cancelled', async () => {
    await mountView();
    await openMenu('Milk');

    for (const action of ['Change icon', 'Store section']) {
      button(action).click();
      await flushPromises();
      button('Cancel').click();
      await flushPromises();
      expect(body().querySelector('[data-testid="item-menu"]')).not.toBeNull();
    }
    expect(route.value.query.overlay).toBe('item-menu');
    expect(api.patch).not.toHaveBeenCalled();
  });

  it('moves a custom item to another section, which re-sorts the list', async () => {
    vi.mocked(api.patch).mockResolvedValue({ data: { item: { ...KOMBUCHA, sectionKey: 'beverages' } } });
    await mountView();
    expect(toBuyNames()).toEqual(['Milk', 'Kombucha']);
    await openMenu('Kombucha');

    button('Store section').click();
    await flushPromises();
    const radios = Array.from(body().querySelectorAll<HTMLButtonElement>('[data-testid="section-choice"]'));
    expect(radios.map((radio) => radio.textContent?.trim())).toEqual(['Milk & Cheese', 'Beverages']);
    radios[1].click();
    await flushPromises();
    expect(radios[1].getAttribute('aria-checked')).toBe('true');
    button('Save section').click();
    await flushPromises();

    expect(api.patch).toHaveBeenCalledWith('/lists/list-1/items/i2', { sectionKey: 'beverages' });
    const menu = body().querySelector('[data-testid="item-menu"]');
    expect(menu?.textContent).toContain('Custom item · Beverages');
    expect(toBuyNames()).toEqual(['Milk', 'Kombucha']);
  });

  it('clears the override when an item goes back to its own section', async () => {
    vi.mocked(api.get).mockImplementation(((url: string) => {
      if (url === '/catalog') return Promise.resolve({ data: CATALOG });
      if (url.endsWith('/items')) {
        return Promise.resolve({
          data: { sectionOrder: ['milk-cheese', 'beverages', 'own-items'], items: [listItem({ sectionKey: 'beverages' })], customItems: [] },
        });
      }
      return Promise.resolve({ data: { shoppingList: { id: 'list-1', name: 'Home', members: [], pendingInvitations: [] } } });
    }) as typeof api.get);
    vi.mocked(api.patch).mockResolvedValue({ data: { item: listItem({}) } });
    await mountView();
    await openMenu('Milk');

    button('Store section').click();
    await flushPromises();
    body().querySelectorAll<HTMLButtonElement>('[data-testid="section-choice"]')[0].click();
    await flushPromises();
    button('Save section').click();
    await flushPromises();

    expect(api.patch).toHaveBeenCalledWith('/lists/list-1/items/i1', { sectionKey: null });
  });
});
