import { ref } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';

import { useAuthStore } from '@/stores/auth';

const LoginView = () => import('@/views/LoginView.vue');
const AuthCallbackView = () => import('@/views/AuthCallbackView.vue');
const ShoppingListsView = () => import('@/views/ShoppingListsView.vue');
const ShoppingListDetailView = () => import('@/views/ShoppingListDetailView.vue');
const AccountView = () => import('@/views/AccountView.vue');
const ShoppingListSettingsView = () => import('@/views/ShoppingListSettingsView.vue');
const ShoppingListSectionPlaceholderView = () => import('@/views/ShoppingListSectionPlaceholderView.vue');
const DishesView = () => import('@/views/DishesView.vue');
const DishFormView = () => import('@/views/DishFormView.vue');

export const currentPageTitle = ref<string | null>(null);

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/lists',
    },
    {
      path: '/login',
      name: 'login',
      component: LoginView,
      meta: { guestOnly: true },
    },
    {
      path: '/auth/callback',
      name: 'auth-callback',
      component: AuthCallbackView,
      meta: { guestOnly: true },
    },
    {
      path: '/lists',
      name: 'shoppingLists',
      component: ShoppingListsView,
      // The view renders its own "My lists" header in place of AppTopbar.
      meta: { requiresAuth: true, title: 'Lists', hideTopbar: true },
    },
    {
      path: '/lists/:id',
      name: 'list-detail',
      component: ShoppingListDetailView,
      // List sections and Account render their own ScreenHeader.
      meta: { requiresAuth: true, title: 'List', hideTopbar: true },
    },
    {
      path: '/lists/:id/dishes',
      name: 'list-dishes',
      component: DishesView,
      meta: { requiresAuth: true, title: 'Dishes', hideTopbar: true },
    },
    {
      path: '/lists/:id/dishes/new',
      name: 'list-dish-new',
      component: DishFormView,
      meta: { requiresAuth: true, title: 'New dish', hideTopbar: true },
    },
    {
      path: '/lists/:id/dishes/:dishId',
      name: 'list-dish',
      component: DishFormView,
      meta: { requiresAuth: true, title: 'Dish', hideTopbar: true },
    },
    {
      path: '/lists/:id/week',
      name: 'list-week',
      component: ShoppingListSectionPlaceholderView,
      props: { section: 'list-week' },
      meta: { requiresAuth: true, title: 'Week', hideTopbar: true },
    },
    {
      path: '/lists/:id/settings',
      name: 'list-settings',
      component: ShoppingListSettingsView,
      meta: { requiresAuth: true, title: 'List Settings', hideTopbar: true },
    },
    {
      path: '/account',
      name: 'account',
      component: AccountView,
      meta: { requiresAuth: true, title: 'Account', hideTopbar: true },
    },
  ],
});

router.beforeEach(async (to) => {
  const authStore = useAuthStore();

  // ADR-0018: with no access token in localStorage nothing can 401, so the
  // renew-and-retry interceptor never fires. Try the httpOnly refresh cookie
  // instead — after a storage eviction it is the only surviving credential.
  // Bounded to one attempt per page load inside lib/sessionRefresh.
  if (!authStore.token) {
    await authStore.tryRestoreSession();
  }

  if (authStore.token && !authStore.user) {
    await authStore.fetchCurrentUser();
  }

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }

  if (to.meta.guestOnly && authStore.isAuthenticated) {
    return { name: 'shoppingLists' };
  }

  return true;
});
