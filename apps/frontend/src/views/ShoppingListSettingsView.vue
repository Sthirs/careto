<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import { api } from '@/lib/api';
import { goBackTo } from '@/lib/backNavigation';
import ShoppingListSettingsPanel from '@/components/ShoppingListSettingsPanel.vue';
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
    currentPageTitle.value = t('shoppingListDetail.settingsTitleSuffix', {
      name: data.shoppingList.name,
    });
  } catch {
    errorMessage.value = t('shoppingListDetail.loadFailed');
  } finally {
    isLoading.value = false;
  }
};

const goBack = () => {
  goBackTo(router, {
    name: 'list-detail',
    params: { id: shoppingListId.value },
    state: { shoppingListName: shoppingList.value?.name },
  });
};

onMounted(() => {
  if (history.state.shoppingListName) {
    currentPageTitle.value = t('shoppingListDetail.settingsTitleSuffix', {
      name: String(history.state.shoppingListName),
    });
  }
  loadShoppingList();
});

onBeforeUnmount(() => {
  currentPageTitle.value = null;
});
</script>

<template>
  <!-- Topbar: back arrow -->
  <Teleport to="#topbar-leading">
    <button
      type="button"
      class="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 transition hover:bg-white/10 hover:text-slate-100"
      :aria-label="t('shoppingListSettings.backToShoppingList')"
      @click="goBack"
    >
      <svg viewBox="0 0 20 20" class="h-5 w-5 fill-current">
        <path
          fill-rule="evenodd"
          d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z"
          clip-rule="evenodd"
        />
      </svg>
    </button>
  </Teleport>

  <main class="flex-1 overflow-y-auto text-slate-50 sm:px-6 lg:px-8">
    <div class="mx-auto flex max-w-5xl flex-col gap-4">
      <section
        v-if="isLoading"
        class="glass-panel rounded-md px-6 py-5 text-slate-300 sm:px-8"
      >
        {{ t('shoppingListSettings.loading') }}
      </section>

      <template v-else-if="shoppingList">
        <ShoppingListSettingsPanel :shopping-list="shoppingList" @updated="loadShoppingList" />
      </template>

      <p
        v-if="errorMessage"
        class="rounded-md border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
      >
        {{ errorMessage }}
      </p>
    </div>
  </main>
</template>
