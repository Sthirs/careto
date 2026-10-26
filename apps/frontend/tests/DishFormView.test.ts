import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';

import DishFormView from '@/views/DishFormView.vue';
import { resetItemCatalogCache } from '@/composables/useItemCatalog';
import { i18n } from '@/i18n';
import { api } from '@/lib/api';

const CATALOG = {
  sections: [{ key: 'pantry' }, { key: 'own-items' }],
  items: [
    { key: 'pasta', sectionKey: 'pantry' },
    { key: 'canned-tomatoes', sectionKey: 'pantry' },
  ],
};

const route = { name: 'list-dish-new', params: { id: 'list-1' } as Record<string, string>, meta: {}, query: {}, path: '/x' };
const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn(), resolve: vi.fn(() => ({ fullPath: '/lists/list-1/dishes' })), afterEach: () => () => {}, options: { history: { state: {} } } };

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

vi.mock('vue-router', async () => {
  const { defineComponent, h } = await import('vue');
  return {
    RouterLink: defineComponent({
      props: { to: { type: Object, required: true } },
      setup: (_props, { slots }) => () => h('a', slots.default?.()),
    }),
    useRoute: () => route,
    useRouter: () => router,
  };
});

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ user: { id: 'u1', displayName: 'Alice', imageUrl: null }, isAuthenticated: true }),
}));

const mountView = async () => {
  const wrapper = mount(DishFormView, { global: { plugins: [i18n] }, attachTo: document.body });
  await flushPromises();
  return wrapper;
};

const saveButton = (wrapper: Awaited<ReturnType<typeof mountView>>) =>
  wrapper.findAll('button').find((b) => ['Save dish', 'Save changes'].includes(b.text()))!;

describe('DishFormView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    resetItemCatalogCache();
    route.name = 'list-dish-new';
    route.params = { id: 'list-1' };
    vi.mocked(api.get).mockImplementation(((url: string) => {
      if (url === '/catalog') return Promise.resolve({ data: CATALOG });
      if (url.endsWith('/items')) return Promise.resolve({ data: { sectionOrder: [], items: [], customItems: [] } });
      return Promise.resolve({
        data: {
          dish: {
            id: 'd1',
            name: 'Lasagna',
            imageUrl: null,
            pausedUntil: '2999-01-01',
            lastAddedAt: null,
            inList: false,
            ingredients: [{ id: 'i1', catalogItemKey: 'pasta', customItem: null, sectionKey: 'pantry' }],
          },
        },
      });
    }) as typeof api.get);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('keeps Save disabled until there is a name and an ingredient', async () => {
    const wrapper = await mountView();
    expect(wrapper.text()).toContain('No ingredients yet.');
    expect(saveButton(wrapper).attributes('disabled')).toBeDefined();

    await wrapper.find('#dish-name').setValue('Pasta al pomodoro');
    expect(saveButton(wrapper).attributes('disabled')).toBeDefined();

    await wrapper.find('#item-search').setValue('pas');
    await wrapper.find('button[aria-label="Add Pasta"]').trigger('click');
    expect(saveButton(wrapper).attributes('disabled')).toBeUndefined();

    await wrapper.find('#dish-name').setValue('   ');
    expect(saveButton(wrapper).attributes('disabled')).toBeDefined();
  });

  it('marks a picked ingredient as added and creates the dish', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { dish: { id: 'd9' } } });
    const wrapper = await mountView();

    await wrapper.find('#dish-name').setValue(' Pasta al pomodoro ');
    await wrapper.find('#item-search').setValue('pas');
    await wrapper.find('button[aria-label="Add Pasta"]').trigger('click');
    await wrapper.find('#item-search').setValue('pas');
    expect(wrapper.find('button[aria-label="Pasta is already an ingredient"]').exists()).toBe(true);
    await wrapper.find('#item-search').setValue('Basil from the garden');
    await wrapper.find('button[aria-label="Add Basil from the garden as a custom item"]').trigger('click');

    await saveButton(wrapper).trigger('click');
    await flushPromises();

    expect(api.post).toHaveBeenCalledWith('/lists/list-1/dishes', {
      name: 'Pasta al pomodoro',
      ingredients: [{ catalogItemKey: 'pasta' }, { customName: 'Basil from the garden' }],
    });
    expect(router.replace).toHaveBeenCalledWith({ name: 'list-dishes', params: { id: 'list-1' } });
  });

  it('edits an existing dish and shows its pause', async () => {
    route.name = 'list-dish';
    route.params = { id: 'list-1', dishId: 'd1' };
    vi.mocked(api.put).mockResolvedValue({ data: {} });
    const wrapper = await mountView();

    expect((wrapper.find('#dish-name').element as HTMLInputElement).value).toBe('Lasagna');
    expect(wrapper.find('[data-testid="dish-ingredients"]').text()).toContain('Pasta');
    expect(wrapper.text()).toContain('Paused until');
    expect(wrapper.text()).toContain('Delete dish');

    await wrapper.find('button[aria-label="Remove Pasta"]').trigger('click');
    expect(saveButton(wrapper).attributes('disabled')).toBeDefined();
    await wrapper.find('#item-search').setValue('tomat');
    await wrapper.find('button[aria-label="Add Canned tomatoes"]').trigger('click');
    await saveButton(wrapper).trigger('click');
    await flushPromises();

    expect(api.put).toHaveBeenCalledWith('/lists/list-1/dishes/d1', {
      name: 'Lasagna',
      ingredients: [{ catalogItemKey: 'canned-tomatoes' }],
    });
  });
});
