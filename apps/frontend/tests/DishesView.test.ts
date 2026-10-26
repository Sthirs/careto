import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';

import DishesView from '@/views/DishesView.vue';
import { i18n } from '@/i18n';
import { api } from '@/lib/api';
import type { Dish } from '@/types/dish';

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

vi.mock('vue-router', async () => {
  const { defineComponent, h } = await import('vue');
  return {
    RouterLink: defineComponent({
      props: { to: { type: Object, required: true } },
      setup: (_props, { slots, attrs }) => () => h('a', attrs, slots.default?.()),
    }),
    useRoute: () => ({ params: { id: 'list-1' }, meta: {}, query: {} }),
    useRouter: () => ({ push: vi.fn(), afterEach: () => () => {}, options: { history: { state: {} } } }),
  };
});

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ user: { id: 'u1', displayName: 'Alice', imageUrl: null }, isAuthenticated: true }),
}));

const dish = (id: string, overrides: Partial<Dish> = {}): Dish => ({
  id,
  name: id,
  imageUrl: null,
  pausedUntil: null,
  lastAddedAt: null,
  inList: false,
  ingredients: [],
  ...overrides,
});

let dishes: Dish[];

const mountView = async () => {
  const wrapper = mount(DishesView, { global: { plugins: [i18n] }, attachTo: document.body });
  await flushPromises();
  return wrapper;
};

const names = (wrapper: Awaited<ReturnType<typeof mountView>>, testId: string) =>
  wrapper.findAll(`[data-testid="${testId}"] [data-testid="dish-card"]`).map((card) => card.attributes('data-dish-name'));

describe('DishesView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    Object.defineProperty(window, 'history', { value: { state: {} }, writable: true, configurable: true });
    dishes = [];
    vi.mocked(api.get).mockImplementation((() => Promise.resolve({ data: { dishes } })) as typeof api.get);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('shows both sections with their empty text when there are no dishes', async () => {
    const wrapper = await mountView();

    expect(wrapper.find('[data-testid="dishes-in-list"]').text()).toContain('No dishes in the list yet.');
    expect(wrapper.find('[data-testid="dishes-suggested"]').text()).toContain('No dishes to suggest.');
    expect(wrapper.find('[data-testid="paused-dishes"]').exists()).toBe(false);
    expect(wrapper.text()).toContain('New dish');
  });

  it('says there is nothing else to suggest when every dish is in the list', async () => {
    dishes = [dish('Pizza', { inList: true })];
    const wrapper = await mountView();

    expect(names(wrapper, 'dishes-in-list')).toEqual(['Pizza']);
    expect(wrapper.find('[data-testid="dishes-suggested"]').text()).toContain('Nothing else to suggest right now.');
  });

  it('adds a suggested dish to the list', async () => {
    dishes = [dish('Soup')];
    vi.mocked(api.post).mockResolvedValue({ data: { dish: dish('Soup', { inList: true }) } });
    const wrapper = await mountView();

    await wrapper.find('button[aria-label="Add Soup to the list"]').trigger('click');
    await flushPromises();

    expect(api.post).toHaveBeenCalledWith('/lists/list-1/dishes/Soup/list');
    expect(names(wrapper, 'dishes-in-list')).toEqual(['Soup']);
  });

  it('undoes a dish and puts it back when the request fails', async () => {
    dishes = [dish('Soup', { inList: true })];
    vi.mocked(api.delete).mockRejectedValue(new Error('offline'));
    const wrapper = await mountView();

    await wrapper.find('button[aria-label="Soup is in the list. Tap to remove its ingredients"]').trigger('click');
    await flushPromises();

    expect(names(wrapper, 'dishes-in-list')).toEqual(['Soup']);
    expect(wrapper.find('[role="alert"]').exists()).toBe(true);
  });

  it('lists paused dishes with a count and resumes one', async () => {
    dishes = [dish('Lasagna', { pausedUntil: '2999-01-01' })];
    vi.mocked(api.patch).mockResolvedValue({ data: { dish: dish('Lasagna') } });
    const wrapper = await mountView();

    expect(wrapper.find('[data-testid="paused-count"]').text()).toBe('1');
    await wrapper.find('button[aria-label="Resume Lasagna"]').trigger('click');
    await flushPromises();

    expect(api.patch).toHaveBeenCalledWith('/lists/list-1/dishes/Lasagna', { pausedUntil: null });
    expect(names(wrapper, 'dishes-suggested')).toEqual(['Lasagna']);
    expect(wrapper.find('[data-testid="paused-dishes"]').exists()).toBe(false);
  });
});
