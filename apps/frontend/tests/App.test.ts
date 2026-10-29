import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';

import App from '../src/App.vue';

const mockRouteMeta = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));

vi.mock('vue-router', () => ({
  useRoute: () => ({ meta: mockRouteMeta.value }),
  createRouter: (options: any) => ({
    beforeEach: vi.fn(),
    afterEach: vi.fn(),
  }),
  createWebHistory: () => ({}),
}));

const mountApp = () =>
  mount(App, {
    global: {
      stubs: {
        RouterView: true,
        AppTopbar: true,
      },
    },
  });

describe('App', () => {
  beforeEach(() => {
    mockRouteMeta.value = { requiresAuth: false };
  });

  it('renders router outlet shell', () => {
    expect(mountApp().html()).toContain('router-view-stub');
  });

  it('shows the topbar on authenticated routes', () => {
    mockRouteMeta.value = { requiresAuth: true };
    expect(mountApp().find('app-topbar-stub').exists()).toBe(true);
  });

  it('hides the topbar but keeps the app shell when the route sets hideTopbar', () => {
    mockRouteMeta.value = { requiresAuth: true, hideTopbar: true };
    const wrapper = mountApp();
    expect(wrapper.find('app-topbar-stub').exists()).toBe(false);
    expect(wrapper.classes()).toContain('h-screen');
  });
});
