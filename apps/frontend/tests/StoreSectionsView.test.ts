import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';

import StoreSectionsView from '@/views/StoreSectionsView.vue';
import { resetItemCatalogCache } from '@/composables/useItemCatalog';
import { i18n } from '@/i18n';
import { api } from '@/lib/api';

const router = vi.hoisted(() => ({ replace: vi.fn(), back: vi.fn() }));

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

vi.mock('vue-router', async () => {
  const { defineComponent, h } = await import('vue');
  return {
    RouterLink: defineComponent({ setup: (_p, { slots }) => () => h('a', slots.default?.()) }),
    useRoute: () => ({ params: { id: 'list-1' }, meta: {}, query: {} }),
    useRouter: () => ({
      ...router,
      resolve: () => ({ fullPath: '/lists/list-1/settings' }),
      afterEach: () => () => {},
      options: { history: { state: {} } },
    }),
  };
});

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ user: { id: 'u1', displayName: 'Alice', imageUrl: null }, isAuthenticated: true }),
}));

const CATALOG = {
  sections: [{ key: 'fruits-vegetables' }, { key: 'milk-cheese' }, { key: 'beverages' }, { key: 'own-items' }],
  items: [
    { key: 'pineapple', sectionKey: 'fruits-vegetables' },
    { key: 'apricot', sectionKey: 'fruits-vegetables' },
    { key: 'milk', sectionKey: 'milk-cheese' },
  ],
};
const DEFAULT = ['fruits-vegetables', 'milk-cheese', 'beverages'];

const mountView = async () => {
  const wrapper = mount(StoreSectionsView, { global: { plugins: [i18n] }, attachTo: document.body });
  await flushPromises();
  return wrapper;
};

type Wrapper = Awaited<ReturnType<typeof mountView>>;
const rows = (wrapper: Wrapper) =>
  wrapper.findAll('[data-testid="store-section"]').map((row) => row.attributes('data-section-key'));
const grip = (wrapper: Wrapper, key: string) =>
  wrapper.find(`[data-section-key="${key}"] [data-testid="section-grip"]`);
const saveButton = (wrapper: Wrapper) =>
  wrapper.findAll('button').find((button) => button.text() === 'Save order')!;

describe('StoreSectionsView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    resetItemCatalogCache();
    vi.mocked(api.get).mockImplementation(((url: string) =>
      Promise.resolve({
        data: url === '/catalog' ? CATALOG : { sectionKeys: ['milk-cheese', 'fruits-vegetables', 'beverages'] },
      })) as typeof api.get);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('lists the sections in the list order, with names and item counts', async () => {
    const wrapper = await mountView();

    expect(rows(wrapper)).toEqual(['milk-cheese', 'fruits-vegetables', 'beverages']);
    const first = wrapper.find('[data-testid="store-section"]');
    expect(first.text()).toContain('Milk & Cheese');
    expect(first.text()).toContain('1 item');
    expect(grip(wrapper, 'fruits-vegetables').attributes('aria-label')).toBe(
      'Move Fruits & Vegetables, position 2 of 3. Use the up and down arrow keys.',
    );
  });

  it('moves a section with the arrow keys and saves the whole order', async () => {
    vi.mocked(api.put).mockResolvedValue({ data: { sectionKeys: ['milk-cheese', 'beverages', 'fruits-vegetables'] } });
    const wrapper = await mountView();

    await grip(wrapper, 'beverages').trigger('keydown', { key: 'ArrowUp' });
    expect(rows(wrapper)).toEqual(['milk-cheese', 'beverages', 'fruits-vegetables']);
    await grip(wrapper, 'milk-cheese').trigger('keydown', { key: 'ArrowUp' });
    expect(rows(wrapper)).toEqual(['milk-cheese', 'beverages', 'fruits-vegetables']);

    await saveButton(wrapper).trigger('click');
    await flushPromises();
    expect(api.put).toHaveBeenCalledWith('/lists/list-1/section-order', {
      sectionKeys: ['milk-cheese', 'beverages', 'fruits-vegetables'],
    });
    expect(router.replace).toHaveBeenCalledWith({ name: 'list-settings', params: { id: 'list-1' } });
  });

  it('drags a section by its grip', async () => {
    const wrapper = await mountView();
    const sections = wrapper.findAll('[data-testid="store-section"]');
    sections.forEach((row, index) => {
      vi.spyOn(row.element, 'getBoundingClientRect').mockReturnValue({ top: index * 70, height: 64 } as DOMRect);
    });

    const list = wrapper.find('[data-testid="store-sections"]');
    await grip(wrapper, 'beverages').trigger('pointerdown', { pointerId: 1, clientY: 170, button: 0, pointerType: 'mouse' });
    await list.trigger('pointermove', { pointerId: 1, clientY: 10 });
    expect(wrapper.find('[data-testid="drop-line"]').exists()).toBe(true);
    await list.trigger('pointerup', { pointerId: 1, clientY: 10 });

    expect(rows(wrapper)).toEqual(['beverages', 'milk-cheese', 'fruits-vegetables']);
  });

  it('saves the default order by resetting it', async () => {
    vi.mocked(api.delete).mockResolvedValue({ data: { sectionKeys: DEFAULT } });
    const wrapper = await mountView();

    await wrapper.findAll('button').find((button) => button.text() === 'Reset to default order')!.trigger('click');
    expect(rows(wrapper)).toEqual(DEFAULT);
    await saveButton(wrapper).trigger('click');
    await flushPromises();

    expect(api.delete).toHaveBeenCalledWith('/lists/list-1/section-order');
    expect(api.put).not.toHaveBeenCalled();
  });

  it('stays on the screen with an error when saving fails', async () => {
    vi.mocked(api.put).mockRejectedValue(new Error('offline'));
    const wrapper = await mountView();

    await grip(wrapper, 'beverages').trigger('keydown', { key: 'ArrowUp' });
    await saveButton(wrapper).trigger('click');
    await flushPromises();

    expect(wrapper.find('[role="alert"]').text()).toBe('We could not save the order. Try again.');
    expect(router.replace).not.toHaveBeenCalled();
  });
});
