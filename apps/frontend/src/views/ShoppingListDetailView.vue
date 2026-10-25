<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import TopbarBackButton from '@/components/list-detail/TopbarBackButton.vue';
import TopbarSettingsButtons from '@/components/list-detail/TopbarSettingsButtons.vue';
import { api } from '@/lib/api';
import { goBackTo } from '@/lib/backNavigation';
import { currentPageTitle } from '@/router';

import type { ShoppingListDetail } from '@/types/shoppingList';

const { t } = useI18n();

const route = useRoute();
const router = useRouter();

const shoppingList = ref<ShoppingListDetail | null>(null);
const isLoading = ref(true);
const errorMessage = ref('');

const shoppingListId = computed(() => route.params.id as string);

const loadShoppingList = async () => {
  isLoading.value = true;
  errorMessage.value = '';

  try {
    const { data } = await api.get<{ shoppingList: ShoppingListDetail }>(
      `/lists/${shoppingListId.value}`,
    );
    shoppingList.value = data.shoppingList;
    currentPageTitle.value = data.shoppingList.name;
  } catch {
    errorMessage.value = t('shoppingListDetail.loadFailed');
  } finally {
    isLoading.value = false;
  }
};

const goBack = () => {
  goBackTo(router, { name: 'shoppingLists' });
};

onMounted(() => {
  if (history.state.shoppingListName) {
    currentPageTitle.value = String(history.state.shoppingListName);
  }
  loadShoppingList();
});

onBeforeUnmount(() => {
  currentPageTitle.value = null;
});
</script>

<template>
  <!-- Topbar: back arrow -->
  <TopbarBackButton @back="goBack" />

  <!-- Topbar: actions -->
  <TopbarSettingsButtons
    :shopping-list="shoppingList"
    :shopping-list-id="shoppingListId"
  />

  <main class="flex flex-col flex-1 min-h-0 text-[#FFFFFF]">
    <div class="mx-auto w-full max-w-5xl flex flex-col flex-1 min-h-0">
      <!-- Loading -->
      <div
        v-if="isLoading"
        class="flex-1 flex items-center justify-center text-[#D3DAE0]"
      >
        {{ t('shoppingListDetail.loading') }}
      </div>

      <!-- Items, dishes and week plan sections land here. -->
      <div
        v-else-if="shoppingList"
        data-testid="list-empty"
        class="flex-1 flex items-center justify-center px-4 text-[#D3DAE0]"
      >
        {{ t('shoppingListDetail.empty') }}
      </div>

      <!-- Error -->
      <div
        v-if="errorMessage"
        class="flex-1 flex items-center justify-center px-4"
      >
        <p
          class="rounded-md border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
        >
          {{ errorMessage }}
        </p>
      </div>
    </div>
  </main>
</template>
