<script setup lang="ts">
import axios from 'axios';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import AccountAvatarLink from '@/components/AccountAvatarLink.vue';
import ItemMenuSheet from '@/components/list-items/ItemMenuSheet.vue';
import ItemSearchField from '@/components/list-items/ItemSearchField.vue';
import ItemSearchResults from '@/components/list-items/ItemSearchResults.vue';
import LastUsedSection from '@/components/list-items/LastUsedSection.vue';
import ListItemTile from '@/components/list-items/ListItemTile.vue';
import SyncStatusBanner from '@/components/list-items/SyncStatusBanner.vue';
import ListSectionsDock from '@/components/list-sections/ListSectionsDock.vue';
import ScreenHeader from '@/components/ScreenHeader.vue';
import { useItemCatalog } from '@/composables/useItemCatalog';
import { tileIconOf, useItemMenu } from '@/composables/useItemMenu';
import { useItemSearch, type SearchResult } from '@/composables/useItemSearch';
import { NeedsConnectionError, useListItems } from '@/composables/useListItems';
import { api } from '@/lib/api';
import { goBackTo } from '@/lib/backNavigation';
import { clearLastListId } from '@/lib/lastList';
import { browserOnline } from '@/lib/offline/connectivity';
import { readListSnapshot, saveListSnapshot } from '@/lib/offline/listSnapshot';
import { isTransientFailure } from '@/lib/offline/networkErrors';
import { pendingOps, syncState } from '@/lib/offline/outbox';
import { sortLastUsed, sortToBuy } from '@/lib/listItemOrder';
import { useAuthStore } from '@/stores/auth';

import type { ListItem } from '@/types/listItem';
import type { ShoppingListDetail } from '@/types/shoppingList';

const REMOVE_HINT_ID = 'list-item-remove-hint';

const { t, locale } = useI18n();

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const shoppingList = ref<ShoppingListDetail | null>(null);
const isLoading = ref(true);
const errorMessage = ref('');
const actionError = ref('');
const announcement = ref('');
const query = ref('');
const lastUsedExpanded = ref(true);
// Seeded from history state so the header has a title before the fetch lands.
const title = ref<string>(history.state?.shoppingListName ? String(history.state.shoppingListName) : '');

const shoppingListId = computed(() => route.params.id as string);

const { catalog, loadCatalog } = useItemCatalog();
const {
  items,
  customItems,
  sectionOrder,
  overrides,
  loadItems,
  addItem,
  setStatus,
  removeItem,
  setOverride,
} = useListItems(() => shoppingListId.value, {
  // A 404 means another member removed the item: the reload says it all.
  // A 409 means a later change of the item won over this one (ADR-0031).
  onRejected: ({ status }) => {
    if (status === 409) actionError.value = t('shoppingListDetail.syncSuperseded');
    else if (status !== 404) actionError.value = t('shoppingListDetail.syncRejected');
  },
});
const pendingCount = computed(() => pendingOps.value.filter((op) => op.listId === shoppingListId.value).length);
const toBuyKeys = computed(
  () =>
    new Set(
      items.value
        .filter((item) => item.status === 'to_buy')
        .map((item) => item.catalogItemKey ?? item.customItem?.id ?? ''),
    ),
);
const results = useItemSearch(query, catalog, customItems, toBuyKeys, overrides);

const labelOf = (item: ListItem) =>
  item.customItem ? item.customItem.name : t(`catalog.items.${item.catalogItemKey}`);

const tileOf = (item: ListItem) => ({
  id: item.id,
  label: labelOf(item),
  icon: tileIconOf(item),
  fromDish: item.source === 'dish',
  fromPlanner: item.source === 'recurring',
});

const toBuy = computed(() =>
  sortToBuy(items.value, sectionOrder.value, labelOf, locale.value).map(tileOf),
);
const lastUsed = computed(() => sortLastUsed(items.value).map(tileOf));
const isSearching = computed(() => query.value.trim().length > 0);

const loadDetail = async (): Promise<ShoppingListDetail> => {
  const listId = shoppingListId.value;
  const userId = authStore.user?.id;
  try {
    const { data } = await api.get<{ shoppingList: ShoppingListDetail }>(`/lists/${listId}`);
    if (userId) saveListSnapshot(userId, listId, { shoppingList: data.shoppingList });
    return data.shoppingList;
  } catch (error: unknown) {
    // Offline (ADR-0030): the copy saved on the last visit, if any.
    const copy = userId && isTransientFailure(error) ? readListSnapshot(userId, listId)?.shoppingList : null;
    if (!copy) throw error;
    return copy;
  }
};

const loadShoppingList = async () => {
  isLoading.value = true;
  errorMessage.value = '';

  try {
    const [detail] = await Promise.all([loadDetail(), loadItems(), loadCatalog()]);
    shoppingList.value = detail;
    title.value = detail.name;
  } catch (error) {
    // The list is gone or the user left it: stop reopening it on launch, and
    // when the launch reopened it, fall back to My lists instead of an error.
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      if (authStore.user) clearLastListId(authStore.user.id);
      if (history.state?.restoredLastList) {
        void router.replace({ name: 'shoppingLists' });
        return;
      }
    }
    errorMessage.value = t('shoppingListDetail.loadFailed');
  } finally {
    isLoading.value = false;
  }
};

const runAction = async (action: () => Promise<unknown>) => {
  actionError.value = '';
  try {
    await action();
  } catch (error: unknown) {
    actionError.value =
      error instanceof NeedsConnectionError
        ? t('shoppingListDetail.needsConnection')
        : t('shoppingListDetail.actionFailed');
  }
};

const itemById = (id: string) => items.value.find((item) => item.id === id);

const markBought = (id: string) => {
  const item = itemById(id);
  if (item) void runAction(() => setStatus(item, 'bought'));
};

const addBack = (id: string) => {
  const item = itemById(id);
  if (item) void runAction(() => setStatus(item, 'to_buy'));
};

const remove = (id: string) => {
  const item = itemById(id);
  if (!item) return;
  announcement.value = t('shoppingListDetail.removedAnnouncement', { name: labelOf(item) });
  void runAction(() => removeItem(item));
};

const menu = useItemMenu(items, labelOf, {
  remove,
  setOverride: (item, override) => void runAction(() => setOverride(item, override)),
});

const pick = (result: SearchResult) => {
  query.value = '';
  void runAction(() => addItem(result.input));
};

// Every list section goes back to My lists (ADR-0022).
const goBack = () => {
  goBackTo(router, { name: 'shoppingLists' });
};

onMounted(loadShoppingList);
</script>

<template>
  <div class="relative mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col overflow-hidden">
    <ScreenHeader
      :title="title"
      :back-label="t('shoppingListDetail.backToShoppingLists')"
      @back="goBack"
    >
      <template #trailing><AccountAvatarLink /></template>
    </ScreenHeader>

    <main class="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 pt-3 pb-[220px]">
      <p v-if="isLoading" class="flex flex-1 items-center justify-center text-text-secondary">
        {{ t('shoppingListDetail.loading') }}
      </p>

      <template v-else-if="shoppingList">
        <SyncStatusBanner :online="browserOnline" :waiting="syncState === 'waiting'" :pending-count="pendingCount" />
        <p v-if="actionError" role="alert" class="rounded-xl border border-danger/40 bg-danger/15 px-4 py-3 text-sm font-semibold text-white">
          {{ actionError }}
        </p>
        <p
          v-if="items.length === 0"
          data-testid="list-empty"
          class="flex flex-1 items-center justify-center text-text-secondary"
        >
          {{ t('shoppingListDetail.empty') }}
        </p>
        <ul
          v-if="toBuy.length > 0"
          :aria-label="t('shoppingListDetail.toBuyAria')"
          data-testid="to-buy"
          class="m-0 flex shrink-0 list-none flex-col gap-1 overflow-hidden rounded-xl p-0"
        >
          <ListItemTile
            v-for="tile in toBuy"
            :key="tile.id"
            tone="to-buy"
            :label="tile.label"
            :icon="tile.icon"
            :from-dish="tile.fromDish"
            :from-planner="tile.fromPlanner"
            :action-label="t('shoppingListDetail.markBoughtAria', { name: tile.label })"
            :described-by="REMOVE_HINT_ID"
            :menu-label="t('shoppingListDetail.moreOptionsAria', { name: tile.label })"
            @activate="markBought(tile.id)"
            @remove="remove(tile.id)"
            @menu="menu.open(tile.id)"
          />
        </ul>
        <LastUsedSection
          v-if="lastUsed.length > 0"
          v-model:expanded="lastUsedExpanded"
          :items="lastUsed"
          :described-by="REMOVE_HINT_ID"
          @add-back="addBack"
          @remove="remove"
        />
      </template>

      <div v-if="errorMessage" class="flex flex-1 items-center justify-center px-2">
        <p role="alert" class="rounded-xl border border-danger/40 bg-danger/15 px-4 py-3 text-sm font-semibold text-white">
          {{ errorMessage }}
        </p>
      </div>
      <p :id="REMOVE_HINT_ID" class="sr-only">{{ t('shoppingListDetail.removeHint') }}</p>
      <p class="sr-only" aria-live="polite">{{ announcement }}</p>
    </main>

    <button
      v-if="isSearching"
      type="button"
      tabindex="-1"
      class="absolute inset-0 z-[9] bg-black/55"
      :aria-label="t('shoppingListDetail.closeSearch')"
      @click="query = ''"
    ></button>

    <ListSectionsDock :shopping-list-id="shoppingListId" :shopping-list-name="title || undefined" current="list-detail">
      <ItemSearchResults v-if="isSearching" :results="results" @pick="pick" />
      <ItemSearchField v-if="shoppingList" v-model="query" />
    </ListSectionsDock>

    <ItemMenuSheet
      :open="menu.isOpen.value"
      :target="menu.target.value"
      :section-order="sectionOrder"
      @close="menu.close"
      @remove="menu.remove"
      @save-icon="menu.saveIcon"
      @save-section="menu.saveSection"
    />
  </div>
</template>
