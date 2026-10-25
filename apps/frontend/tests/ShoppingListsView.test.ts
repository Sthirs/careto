import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, RouterLinkStub } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';

import ShoppingListsView from '@/views/ShoppingListsView.vue';
import { i18n } from '@/i18n';
import type { ShoppingList, InvitationListItem } from '@/types/shoppingList';

// Mock the api module
const mockApiGet = vi.fn();
const mockApiPost = vi.fn();
vi.mock('@/lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
  },
}));

// Mock vue-router
const mockRouterPush = vi.fn();
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mockRouterPush,
  }),
  RouterLink: { name: 'RouterLink', template: '<a><slot /></a>' },
}));

// Mock the router module's currentPageTitle
const mockCurrentPageTitle = vi.hoisted(() => ({ value: null as string | null }));
vi.mock('@/router', () => ({
  currentPageTitle: mockCurrentPageTitle,
}));

// Mock auth store
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    user: { id: 'user-1', email: 'alice@test.com', displayName: 'Alice' },
    token: 'test-token',
    isAuthenticated: true,
  }),
}));

const makeShoppingList = (overrides: Partial<ShoppingList> = {}): ShoppingList => ({
  id: 'list-1',
  name: 'Weekend in Venice',
  imageUrl: null,
  memberCount: 2,
  members: [
    { id: 'user-1', displayName: 'Alice', email: 'alice@test.com', imageUrl: null },
    { id: 'user-2', displayName: 'Bob', email: 'bob@test.com', imageUrl: null },
  ],
  ...overrides,
});

const mountComponent = async (shoppingLists: ShoppingList[] = []) => {
  mockApiGet.mockResolvedValue({ data: { shoppingLists } });
  const wrapper = mount(ShoppingListsView, { global: { plugins: [i18n], stubs: { RouterLink: RouterLinkStub } } });
  await vi.dynamicImportSettled();
  await wrapper.vm.$nextTick();
  return wrapper;
};

const mountWithInvitations = async (
  invitations: { id: string; shoppingListId: string; shoppingListName: string; inviterName: string; createdAt: string }[],
  shoppingLists: ShoppingList[] = [],
) => {
  mockApiGet.mockResolvedValue({ data: { shoppingLists, invitations } });
  const wrapper = mount(ShoppingListsView, { global: { plugins: [i18n], stubs: { RouterLink: RouterLinkStub } } });
  await vi.dynamicImportSettled();
  await wrapper.vm.$nextTick();
  return wrapper;
};

describe('ShoppingListsView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    mockCurrentPageTitle.value = null;
    mockApiGet.mockReset();
    mockApiPost.mockReset();
    mockApiPost.mockResolvedValue({ data: {} });
  });

  it('renders the "My lists" header with an account link', async () => {
    const wrapper = await mountComponent([makeShoppingList()]);
    expect(wrapper.find('h1').text()).toBe('My lists');
    const links = wrapper.findAllComponents(RouterLinkStub);
    expect(links.some((l) => JSON.stringify(l.props('to')) === JSON.stringify({ name: 'account' }))).toBe(true);
  });

  it('renders the "New list" button and opens the create form with Save/Cancel', async () => {
    const wrapper = await mountComponent([makeShoppingList()]);
    const button = wrapper.findAll('button').find((b) => b.text().includes('New list'));
    expect(button).toBeDefined();
    await button!.trigger('click');
    expect(wrapper.find('input#new-list-name').exists()).toBe(true);
    expect(wrapper.find('button[type="submit"]').text()).toBe('Save');
  });

  it('creates a list on submit and reloads the overview', async () => {
    const wrapper = await mountComponent([]);
    await wrapper.findAll('button').find((b) => b.text().includes('New list'))!.trigger('click');
    await wrapper.find('input#new-list-name').setValue('Weekend at the lake');
    await wrapper.find('form').trigger('submit');
    await vi.dynamicImportSettled();
    expect(mockApiPost).toHaveBeenCalledWith('/lists', { name: 'Weekend at the lake' });
  });

  it('links each card to the list detail route', async () => {
    const wrapper = await mountComponent([makeShoppingList({ id: 'list-9', name: 'Home' })]);
    const card = wrapper.find('[data-testid="list-card"]').findComponent(RouterLinkStub);
    expect(card.props('to')).toMatchObject({ name: 'list-detail', params: { id: 'list-9' } });
  });

  it('renders 2 avatars for a list with 2 members', async () => {
    const wrapper = await mountComponent([
      makeShoppingList({
        members: [
          { id: 'user-1', displayName: 'Alice', email: 'alice@test.com', imageUrl: null },
          { id: 'user-2', displayName: 'Bob', email: 'bob@test.com', imageUrl: null },
        ],
      }),
    ]);
    const avatars = wrapper.findAll('[aria-label="Alice"], [aria-label="Bob"]');
    expect(avatars.length).toBe(2);
    const html = wrapper.html();
    expect(html).not.toMatch(/\+\d+/);
  });

  it('renders 3 avatars + "+2" badge for a list with 5 members', async () => {
    const members = [
      { id: 'u1', displayName: 'Alice', email: 'a@test.com', imageUrl: null },
      { id: 'u2', displayName: 'Bob', email: 'b@test.com', imageUrl: null },
      { id: 'u3', displayName: 'Charlie', email: 'c@test.com', imageUrl: null },
      { id: 'u4', displayName: 'Dave', email: 'd@test.com', imageUrl: null },
      { id: 'u5', displayName: 'Eve', email: 'e@test.com', imageUrl: null },
    ];
    const wrapper = await mountComponent([makeShoppingList({ members, memberCount: 5 })]);
    // First 3 avatars visible
    const aliceAvatar = wrapper.find('[aria-label="Alice"]');
    const bobAvatar = wrapper.find('[aria-label="Bob"]');
    const charlieAvatar = wrapper.find('[aria-label="Charlie"]');
    expect(aliceAvatar.exists()).toBe(true);
    expect(bobAvatar.exists()).toBe(true);
    expect(charlieAvatar.exists()).toBe(true);
    // Dave and Eve not shown as individual avatars
    expect(wrapper.find('[aria-label="Dave"]').exists()).toBe(false);
    expect(wrapper.find('[aria-label="Eve"]').exists()).toBe(false);
    // "+2" badge present
    expect(wrapper.html()).toContain('+2');
  });

  it('renders a coloured initials cover (no <img>) when imageUrl is null', async () => {
    const wrapper = await mountComponent([makeShoppingList({ imageUrl: null, name: 'Weekend in Venice' })]);
    // No <img> tag for this list
    const imgs = wrapper.findAll('[data-testid="list-card"] img');
    expect(imgs.length).toBe(0);
    expect(wrapper.find('[role="img"][aria-label="Weekend in Venice thumbnail"]').exists()).toBe(true);
    // Initials "WV" rendered
    expect(wrapper.html()).toContain('WV');
  });

  it('renders <img> tag when imageUrl is set', async () => {
    const wrapper = await mountComponent([
      makeShoppingList({ imageUrl: 'https://example.com/photo.jpg', name: 'Venice Trip' }),
    ]);
    const img = wrapper.find('[data-testid="list-card"] img');
    expect(img.exists()).toBe(true);
    expect(img.attributes('src')).toBe('https://example.com/photo.jpg');
    expect(img.classes()).toContain('object-cover');
  });

  it('sets currentPageTitle to "My lists" on mount', async () => {
    await mountComponent([makeShoppingList()]);
    expect(mockCurrentPageTitle.value).toBe('My lists');
  });

  it('(F1) surfaces accept/decline errors inline on the matching invitation card', async () => {
    const invitation: InvitationListItem = {
      id: 'inv-1',
      shoppingListId: 'list-A',
      shoppingListName: 'Venice Trip',
      inviterName: 'Bob',
      createdAt: '2026-01-01T00:00:00Z',
    };
    const wrapper = await mountWithInvitations([invitation]);
    const html = wrapper.html();
    expect(html).toContain('Venice Trip');
    expect(html).toContain('Invited by Bob');

    mockApiPost.mockRejectedValueOnce(new Error('network'));

    const buttons = wrapper.findAll('button');
    const acceptButton = buttons.find((b) => b.text().trim() === 'Accept');
    expect(acceptButton).toBeDefined();
    await acceptButton!.trigger('click');
    await wrapper.vm.$nextTick();
    await vi.dynamicImportSettled();

    expect(wrapper.html()).toContain('Could not accept the invitation');

    mockApiPost.mockRejectedValueOnce(new Error('network'));
    const declineButton = wrapper.findAll('button').find((b) => b.text().trim() === 'Decline');
    expect(declineButton).toBeDefined();
    await declineButton!.trigger('click');
    await wrapper.vm.$nextTick();
    await vi.dynamicImportSettled();

    expect(wrapper.html()).toContain('Could not decline the invitation');
  });

  it('renders member avatar with image when member has imageUrl', async () => {
    const wrapper = await mountComponent([
      makeShoppingList({
        members: [
          { id: 'user-1', displayName: 'Alice', email: 'alice@test.com', imageUrl: 'https://example.com/alice.jpg' },
          { id: 'user-2', displayName: 'Bob', email: 'bob@test.com', imageUrl: null },
        ],
      }),
    ]);
    // First member has imageUrl - should render <img>
    const aliceAvatar = wrapper.find('[aria-label="Alice"]');
    expect(aliceAvatar.exists()).toBe(true);
    const img = aliceAvatar.find('img');
    expect(img.exists()).toBe(true);
    expect(img.attributes('src')).toBe('https://example.com/alice.jpg');
    expect(img.attributes('alt')).toBe('');
    expect(img.attributes('aria-hidden')).toBe('true');
    expect(img.classes()).toContain('h-full');
    expect(img.classes()).toContain('w-full');
    expect(img.classes()).toContain('rounded-full');
    expect(img.classes()).toContain('object-cover');
    // Second member has no imageUrl - should render initials
    const bobAvatar = wrapper.find('[aria-label="Bob"]');
    expect(bobAvatar.exists()).toBe(true);
    expect(bobAvatar.find('img').exists()).toBe(false);
    expect(bobAvatar.text()).toContain('B');
  });

  it('renders member avatar initials when member has no imageUrl', async () => {
    const wrapper = await mountComponent([
      makeShoppingList({
        members: [
          { id: 'user-1', displayName: 'Alice', email: 'alice@test.com', imageUrl: null },
          { id: 'user-2', displayName: 'Bob', email: 'bob@test.com', imageUrl: null },
        ],
      }),
    ]);
    const aliceAvatar = wrapper.find('[aria-label="Alice"]');
    expect(aliceAvatar.exists()).toBe(true);
    expect(aliceAvatar.find('img').exists()).toBe(false);
    expect(aliceAvatar.text()).toContain('A');

    const bobAvatar = wrapper.find('[aria-label="Bob"]');
    expect(bobAvatar.exists()).toBe(true);
    expect(bobAvatar.find('img').exists()).toBe(false);
    expect(bobAvatar.text()).toContain('B');
  });
});
