<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import AccountAvatarLink from '@/components/AccountAvatarLink.vue';
import ListSectionsDock from '@/components/list-sections/ListSectionsDock.vue';
import ScreenHeader from '@/components/ScreenHeader.vue';
import { api } from '@/lib/api';
import { goBackTo } from '@/lib/backNavigation';

import type { ShoppingListDetail } from '@/types/shoppingList';

const { t } = useI18n();

const route = useRoute();
const router = useRouter();

const shoppingList = ref<ShoppingListDetail | null>(null);
const isLoading = ref(true);
const errorMessage = ref('');
// Seeded from history state so the header has a title before the fetch lands.
const title = ref<string>(history.state?.shoppingListName ? String(history.state.shoppingListName) : '');

const shoppingListId = computed(() => route.params.id as string);

const loadShoppingList = async () => {
  isLoading.value = true;
  errorMessage.value = '';

  try {
    const { data } = await api.get<{ shoppingList: ShoppingListDetail }>(
      `/lists/${shoppingListId.value}`,
    );
    shoppingList.value = data.shoppingList;
    title.value = data.shoppingList.name;
  } catch {
    errorMessage.value = t('shoppingListDetail.loadFailed');
  } finally {
    isLoading.value = false;
  }
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

    <main class="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pt-3 pb-[140px]">
      <p v-if="isLoading" class="flex flex-1 items-center justify-center text-text-secondary">
        {{ t('shoppingListDetail.loading') }}
      </p>

      <!-- Items land here. -->
      <p
        v-else-if="shoppingList"
        data-testid="list-empty"
        class="flex flex-1 items-center justify-center text-text-secondary"
      >
        {{ t('shoppingListDetail.empty') }}
      </p>

      <div v-if="errorMessage" class="flex flex-1 items-center justify-center px-2">
        <p role="alert" class="rounded-xl border border-danger/40 bg-danger/15 px-4 py-3 text-sm font-semibold text-white">
          {{ errorMessage }}
        </p>
      </div>
    </main>

    <ListSectionsDock :shopping-list-id="shoppingListId" :shopping-list-name="title || undefined" current="list-detail" />
  </div>
</template>
