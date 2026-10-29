import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';

import WeekView from '@/views/WeekView.vue';
import { i18n } from '@/i18n';
import { api } from '@/lib/api';
import type { Dish } from '@/types/dish';
import type { WeekSlot } from '@/types/weekPlan';

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

vi.mock('vue-router', async () => {
  const { defineComponent, h } = await import('vue');
  return {
    RouterLink: defineComponent({
      props: { to: { type: Object, required: true } },
      setup: (_props, { slots, attrs }) => () => h('a', attrs, slots.default?.()),
    }),
    useRoute: () => ({ params: { id: 'list-1' }, meta: {}, query: {} }),
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), afterEach: () => () => {}, options: { history: { state: {} } } }),
  };
});

// Overlays open and close in memory; their URL handling is covered by
// useRoutedOverlay.test.ts.
vi.mock('@/composables/useRoutedOverlay', async () => {
  const { ref } = await import('vue');
  return {
    useRoutedOverlay: () => {
      const isOpen = ref(false);
      return { isOpen, open: () => (isOpen.value = true), close: () => (isOpen.value = false) };
    },
  };
});

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ user: { id: 'u1', displayName: 'Alice', imageUrl: null }, isAuthenticated: true }),
}));

const dish = (id: string, name: string): Dish => ({
  id,
  name,
  imageUrl: null,
  pausedUntil: null,
  lastAddedAt: null,
  inList: false,
  ingredients: [],
});

const DISHES = [dish('pom', 'Pasta al pomodoro'), dish('pol', 'Pollo al limone'), dish('min', 'Minestrone')];
let slots: WeekSlot[];

const mountView = async () => {
  const wrapper = mount(WeekView, { global: { plugins: [i18n] }, attachTo: document.body });
  await flushPromises();
  return wrapper;
};

type Wrapper = Awaited<ReturnType<typeof mountView>>;

const slot = (wrapper: Wrapper, name: string) => wrapper.find(`[data-testid="week-slot"][data-slot="${name}"]`);
const body = () => document.body;
const choice = (name: string) =>
  body().querySelector<HTMLButtonElement>(`[data-testid="week-choice"][data-dish-name="${name}"]`);

describe('WeekView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    Object.defineProperty(window, 'history', { value: { state: {} }, writable: true, configurable: true });
    slots = [{ weekday: 1, meal: 'dinner', dishId: 'pom' }];
    vi.mocked(api.get).mockImplementation(((url: string) =>
      Promise.resolve({ data: url.endsWith('/week') ? { slots } : { dishes: DISHES } })) as typeof api.get);
    vi.mocked(api.put).mockImplementation(((url: string, payload: unknown) => {
      if (url.endsWith('/week')) return Promise.resolve({ data: payload });
      const { weekday, meal, dishId } = payload as WeekSlot;
      const rest = slots.filter((s) => s.weekday !== weekday || s.meal !== meal);
      slots = dishId ? [...rest, { weekday, meal, dishId }] : rest;
      return Promise.resolve({ data: { slots } });
    }) as typeof api.put);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('shows the 7 days with their slots and the planned count', async () => {
    const wrapper = await mountView();

    expect(wrapper.findAll('[data-testid="week-slot"]')).toHaveLength(14);
    expect(slot(wrapper, 'Monday dinner').attributes('data-dish-name')).toBe('Pasta al pomodoro');
    expect(slot(wrapper, 'Monday lunch').attributes('data-empty')).toBe('true');
    expect(wrapper.find('[data-testid="week-planned-count"]').text()).toBe('1 of 14 meals planned');
  });

  it('picks a dish for an empty slot through the searchable picker', async () => {
    const wrapper = await mountView();

    await slot(wrapper, 'Tuesday lunch').trigger('click');
    await flushPromises();
    expect(body().querySelector('[data-testid="week-picker"]')?.textContent).toContain('Dish for Tuesday lunch');

    const search = body().querySelector<HTMLInputElement>('#week-dish-search')!;
    search.value = 'pol';
    search.dispatchEvent(new Event('input'));
    await flushPromises();
    expect(body().querySelectorAll('[data-testid="week-choice"]')).toHaveLength(1);

    choice('Pollo al limone')!.click();
    await flushPromises();
    expect(api.put).toHaveBeenCalledWith('/lists/list-1/week/slots', { weekday: 2, meal: 'lunch', dishId: 'pol' });
    expect(slot(wrapper, 'Tuesday lunch').attributes('data-dish-name')).toBe('Pollo al limone');
  });

  it('says when no dish matches the search', async () => {
    const wrapper = await mountView();
    await slot(wrapper, 'Tuesday lunch').trigger('click');
    await flushPromises();

    const search = body().querySelector<HTMLInputElement>('#week-dish-search')!;
    search.value = 'curry';
    search.dispatchEvent(new Event('input'));
    await flushPromises();
    expect(body().querySelector('[data-testid="week-picker"]')?.textContent).toContain('No dishes match “curry”');
  });

  it('changes the dish of a filled slot, showing the current one', async () => {
    const wrapper = await mountView();

    await slot(wrapper, 'Monday dinner').find('button').trigger('click');
    await flushPromises();
    expect(body().querySelector('[data-testid="week-picker"]')?.textContent).toContain('Now: Pasta al pomodoro');
    expect(choice('Pasta al pomodoro')!.getAttribute('aria-current')).toBe('true');

    choice('Minestrone')!.click();
    await flushPromises();
    expect(slot(wrapper, 'Monday dinner').attributes('data-dish-name')).toBe('Minestrone');
  });

  it('removes a dish from its slot and undoes it', async () => {
    const wrapper = await mountView();

    await wrapper.find('[aria-label="Remove Pasta al pomodoro from Monday dinner"]').trigger('click');
    await flushPromises();
    expect(slot(wrapper, 'Monday dinner').attributes('data-empty')).toBe('true');
    expect(wrapper.find('[data-testid="undo-toast"]').text()).toContain('Pasta al pomodoro removed from Monday dinner');

    await wrapper.find('[data-testid="undo-toast"] button').trigger('click');
    await flushPromises();
    expect(slot(wrapper, 'Monday dinner').attributes('data-dish-name')).toBe('Pasta al pomodoro');
  });

  it('starts a new plan after confirming, and undoes it', async () => {
    const wrapper = await mountView();

    await wrapper.findAll('button').find((b) => b.text() === 'New plan')!.trigger('click');
    await flushPromises();
    const sheet = body().querySelector('[data-testid="new-plan-sheet"]')!;
    expect(sheet.textContent).toContain('All 1 planned meals will be cleared');
    [...sheet.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Clear all')!.click();
    await flushPromises();

    expect(api.put).toHaveBeenCalledWith('/lists/list-1/week', { slots: [] });
    expect(wrapper.find('[data-testid="week-planned-count"]').text()).toBe('0 of 14 meals planned');
    expect(wrapper.find('[data-testid="undo-toast"]').text()).toContain('Week plan cleared');

    await wrapper.find('[data-testid="undo-toast"] button').trigger('click');
    await flushPromises();
    expect(api.put).toHaveBeenLastCalledWith('/lists/list-1/week', {
      slots: [{ weekday: 1, meal: 'dinner', dishId: 'pom' }],
    });
    expect(slot(wrapper, 'Monday dinner').attributes('data-dish-name')).toBe('Pasta al pomodoro');
  });

  it('adds the planned dishes to the list, showing progress then success', async () => {
    vi.useFakeTimers();
    let finish!: () => void;
    vi.mocked(api.post).mockReturnValue(new Promise((resolve) => (finish = () => resolve({ data: undefined }))));
    const wrapper = await mountView();
    const button = () => wrapper.find('[data-testid="add-plan-to-list"]');

    expect(button().text()).toBe('Add ingredients to list');
    await button().trigger('click');
    expect(api.post).toHaveBeenCalledWith('/lists/list-1/week/list');
    expect(button().text()).toBe('Adding…');
    expect(button().attributes('disabled')).toBeDefined();

    finish();
    await flushPromises();
    expect(button().text()).toBe('Added to the list');
    expect(wrapper.text()).toContain('Ingredients of the planned dishes added to the list');

    await vi.advanceTimersByTimeAsync(2500);
    expect(button().text()).toBe('Add ingredients to list');
    vi.useRealTimers();
  });

  it('goes back to the add label and shows an error when adding fails', async () => {
    vi.mocked(api.post).mockRejectedValue(new Error('offline'));
    const wrapper = await mountView();

    await wrapper.find('[data-testid="add-plan-to-list"]').trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-testid="add-plan-to-list"]').text()).toBe('Add ingredients to list');
    expect(wrapper.find('[role="alert"]').text()).toBe('Something went wrong. Please try again.');
  });

  it('disables adding while nothing is planned', async () => {
    slots = [];
    const wrapper = await mountView();

    expect(wrapper.find('[data-testid="add-plan-to-list"]').attributes('disabled')).toBeDefined();
  });
});
