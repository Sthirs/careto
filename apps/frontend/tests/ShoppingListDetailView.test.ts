import { AxiosError } from 'axios';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';

import ShoppingListDetailView from '@/views/ShoppingListDetailView.vue';
import { i18n } from '@/i18n';
import { api } from '@/lib/api';
import { readLastListId, saveLastListId } from '@/lib/lastList';

// The default list payload used by the mocked api.get. Declared as a hoisted
// function (not a const) so the vi.mock factory can call it even though vi.mock
// calls are hoisted above module-level const bindings.
function getDefaultShoppingList() {
  return {
    id: 'list-1',
    name: 'Test List',
    imageUrl: null,
    memberCount: 3,
    members: [
      { id: 'user-1', displayName: 'Alice', email: 'alice@test.com' },
      { id: 'user-2', displayName: 'Bob', email: 'bob@test.com' },
      { id: 'user-3', displayName: 'Charlie', email: 'charlie@test.com' },
    ],
    pendingInvitations: [],
  };
}

async function routerLinkStub() {
  const { defineComponent, h } = await import('vue');
  return defineComponent({
    name: 'RouterLink',
    props: { to: { type: Object, required: true } },
    setup(props, { slots }) {
      return () => h('a', { 'data-to': JSON.stringify(props.to) }, slots.default?.());
    },
  });
}

// Mock the api module
// The view also loads its items and the shared catalog; both are empty here
// (the item behaviour is covered by ShoppingListDetailItems.test.ts).
function defaultGet(url: string) {
  if (url === '/catalog') return Promise.resolve({ data: { sections: [], items: [] } });
  if (url.endsWith('/items')) {
    return Promise.resolve({ data: { sectionOrder: [], items: [], customItems: [] } });
  }
  return Promise.resolve({ data: { shoppingList: getDefaultShoppingList() } });
}

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(defaultGet),
    post: vi.fn().mockResolvedValue({ data: {} }),
    patch: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

// Mock vue-router. `back`/`replace`/`options.history.state`/`afterEach` exist
// only because goBackTo (lib/backNavigation.ts, ADR-0019) is NOT mocked here
// and runs for real against these mocks. `afterEachCallbacks` simulates
// vue-router invoking every registered afterEach guard once a navigation
// settles, which is what clears goBackTo's module-level `popPending` latch —
// without it, the latch set by one test's back-arrow click would leak into
// the next. `mockHistoryBack` is reassigned per-test to control which branch
// goBackTo takes.
const mockRouterPush = vi.fn();
const afterEachCallbacks: Array<() => void> = [];
const mockRouterBack = vi.fn(() => {
  queueMicrotask(() => afterEachCallbacks.forEach((cb) => cb()));
});
const mockRouterReplace = vi.fn(() => {
  queueMicrotask(() => afterEachCallbacks.forEach((cb) => cb()));
  return Promise.resolve(undefined);
});
let mockHistoryBack: string | null = null;
vi.mock('vue-router', async () => ({
  // Renders an <a> exposing its target so tests can assert where it points.
  RouterLink: await routerLinkStub(),
  useRoute: () => ({
    params: { id: 'list-1' },
    meta: { requiresAuth: true },
    query: {},
  }),
  useRouter: () => ({
    push: mockRouterPush,
    back: mockRouterBack,
    replace: mockRouterReplace,
    resolve: (to: { name: string }) => ({
      fullPath: to.name === 'shoppingLists' ? '/lists' : '/unknown',
    }),
    afterEach: (cb: () => void) => {
      afterEachCallbacks.push(cb);
      return () => {};
    },
    options: {
      history: {
        state: {
          get back() {
            return mockHistoryBack;
          },
        },
      },
    },
  }),
}));

// Mock auth store
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    user: { id: 'user-1', email: 'alice@test.com', displayName: 'Alice', imageUrl: null },
    token: 'test-token',
    isAuthenticated: true,
  }),
}));

const mountShoppingListDetailView = () =>
  mount(ShoppingListDetailView, {
    global: {
      plugins: [i18n],
    },
  });

// Queue the list payload returned by api.get for the next mount: the list
// request is the first api.get call of loadShoppingList.
const mockShoppingListResponse = (shoppingList: Record<string, unknown>) => {
  (
    api.get as unknown as { mockResolvedValueOnce: (value: unknown) => unknown }
  ).mockResolvedValueOnce({
    data: { shoppingList },
  });
};

describe('ShoppingListDetailView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    vi.mocked(api.get).mockImplementation(defaultGet as typeof api.get);
    afterEachCallbacks.length = 0;
    mockHistoryBack = null;
    // Mock history.state to avoid null reference in happy-dom
    Object.defineProperty(window, 'history', {
      value: { state: {} },
      writable: true,
      configurable: true,
    });
  });

  it('loads the list by route id and shows its name as the header title', async () => {
    const wrapper = mountShoppingListDetailView();
    await flushPromises();

    expect(api.get).toHaveBeenCalledWith('/lists/list-1');
    expect(api.get).toHaveBeenCalledWith('/lists/list-1/items');
    expect(wrapper.find('h1').text()).toBe('Test List');
    expect(wrapper.find('[data-testid="list-empty"]').exists()).toBe(true);
  });

  it('titles the header from history state before the fetch resolves', async () => {
    Object.defineProperty(window, 'history', {
      value: { state: { shoppingListName: 'From state' } },
      writable: true,
      configurable: true,
    });
    const wrapper = mountShoppingListDetailView();

    expect(wrapper.find('h1').text()).toBe('From state');
  });

  it('shows the load error when the request fails', async () => {
    (
      api.get as unknown as { mockRejectedValueOnce: (value: unknown) => unknown }
    ).mockRejectedValueOnce(new Error('boom'));
    const wrapper = mountShoppingListDetailView();
    await flushPromises();

    expect(wrapper.text()).toContain('We could not load this list.');
    expect(wrapper.find('[data-testid="list-empty"]').exists()).toBe(false);
  });

  const rejectListAsNotFound = () =>
    (
      api.get as unknown as { mockRejectedValueOnce: (value: unknown) => unknown }
    ).mockRejectedValueOnce(new AxiosError('gone', '404', undefined, undefined, { status: 404 } as never));

  it('forgets a list reopened on launch that no longer exists and shows My lists', async () => {
    saveLastListId('user-1', 'list-1');
    Object.defineProperty(window, 'history', {
      value: { state: { restoredLastList: true } },
      writable: true,
      configurable: true,
    });
    rejectListAsNotFound();
    const wrapper = mountShoppingListDetailView();
    await flushPromises();

    expect(readLastListId('user-1')).toBeNull();
    expect(mockRouterReplace).toHaveBeenCalledWith({ name: 'shoppingLists' });
    expect(wrapper.text()).not.toContain('We could not load this list.');
  });

  it('keeps the load error for a deep link to a list that no longer exists', async () => {
    saveLastListId('user-1', 'list-1');
    rejectListAsNotFound();
    const wrapper = mountShoppingListDetailView();
    await flushPromises();

    expect(readLastListId('user-1')).toBeNull();
    expect(mockRouterReplace).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('We could not load this list.');
  });

  it('renders the list sections bar with List as the current section', async () => {
    mockShoppingListResponse({ ...getDefaultShoppingList(), name: 'Pantry' });
    const wrapper = mountShoppingListDetailView();
    await flushPromises();

    const nav = wrapper.find('nav[aria-label="List sections"]');
    expect(nav.exists()).toBe(true);
    const links = nav.findAll('a');
    expect(links.map((l) => l.text())).toEqual(['List', 'Dishes', 'Week', 'Settings']);
    expect(links[0].attributes('aria-current')).toBe('page');
    expect(JSON.parse(links[3].attributes('data-to')!)).toEqual({
      name: 'list-settings',
      params: { id: 'list-1' },
      state: { shoppingListName: 'Pantry' },
    });
  });

  // The back arrow now goes through goBackTo (lib/backNavigation.ts,
  // ADR-0019): it pops history when the previous entry already is `/lists`,
  // and only falls back to a forward `replace` when it is not (e.g. a deep
  // link straight into this page). It never `push`es — that would grow the
  // stack, which is the bug this ADR fixes.
  it('pops history when the previous entry is already the lists list', async () => {
    mockHistoryBack = '/lists';
    const wrapper = mountShoppingListDetailView();

    await vi.dynamicImportSettled();
    await wrapper.vm.$nextTick();

    const backButton = wrapper
      .findAll('button')
      .find((b) => b.attributes('aria-label') === 'Back to lists')!;
    await backButton.trigger('click');
    await flushPromises();

    expect(mockRouterBack).toHaveBeenCalledTimes(1);
    expect(mockRouterReplace).not.toHaveBeenCalled();
    expect(mockRouterPush).not.toHaveBeenCalled();
  });

  it('replaces instead of popping when the previous entry is not the lists list', async () => {
    mockHistoryBack = null; // e.g. a deep link straight into /lists/:id
    const wrapper = mountShoppingListDetailView();

    await vi.dynamicImportSettled();
    await wrapper.vm.$nextTick();

    const backButton = wrapper
      .findAll('button')
      .find((b) => b.attributes('aria-label') === 'Back to lists')!;
    await backButton.trigger('click');
    await flushPromises();

    expect(mockRouterReplace).toHaveBeenCalledWith({ name: 'shoppingLists' });
    expect(mockRouterBack).not.toHaveBeenCalled();
  });
});
