<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import AccountAvatarLink from '@/components/AccountAvatarLink.vue';
import DishSection from '@/components/dishes/DishSection.vue';
import PausedSection from '@/components/dishes/PausedSection.vue';
import ListSectionsDock from '@/components/list-sections/ListSectionsDock.vue';
import ScreenHeader from '@/components/ScreenHeader.vue';
import { useDishes } from '@/composables/useDishes';
import { goBackTo } from '@/lib/backNavigation';
import { toIsoDate } from '@/lib/dishDates';
import { groupDishes } from '@/lib/dishGroups';
import type { Dish } from '@/types/dish';

const { t, locale } = useI18n();
const route = useRoute();
const router = useRouter();

const shoppingListId = computed(() => route.params.id as string);
const shoppingListName: string | undefined = history.state?.shoppingListName
  ? String(history.state.shoppingListName)
  : undefined;

const isLoading = ref(true);
const errorMessage = ref('');
const actionError = ref('');
const pausedExpanded = ref(true);

const { dishes, loadDishes, addToList, removeFromList, resume } = useDishes(() => shoppingListId.value);
const groups = computed(() => groupDishes(dishes.value, toIsoDate(new Date()), locale.value));

// With no dishes at all there is nothing to suggest; otherwise every dish is
// already in the list or paused.
const suggestedEmptyText = computed(() =>
  dishes.value.length === 0 ? t('dishes.suggestedEmptyNone') : t('dishes.suggestedEmptyAll'),
);

const load = async () => {
  isLoading.value = true;
  errorMessage.value = '';
  try {
    await loadDishes();
  } catch {
    errorMessage.value = t('dishes.loadFailed');
  } finally {
    isLoading.value = false;
  }
};

const run = async (action: () => Promise<unknown>) => {
  actionError.value = '';
  try {
    await action();
  } catch {
    actionError.value = t('dishes.actionFailed');
  }
};

const onInListAction = (dish: Dish) => void run(() => removeFromList(dish));
const onSuggestedAction = (dish: Dish) => void run(() => addToList(dish));
const onResume = (dish: Dish) => void run(() => resume(dish));

// Every list section goes back to My lists (ADR-0022).
const goBack = () => {
  goBackTo(router, { name: 'shoppingLists' });
};

onMounted(load);
</script>

<template>
  <div class="relative mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col overflow-hidden">
    <ScreenHeader :title="t('listSections.dishes')" :back-label="t('shoppingListDetail.backToShoppingLists')" @back="goBack">
      <template #trailing><AccountAvatarLink /></template>
    </ScreenHeader>

    <main class="flex min-h-0 flex-1 flex-col gap-5.5 overflow-y-auto px-4 pt-3 pb-[210px]">
      <p v-if="isLoading" class="flex flex-1 items-center justify-center text-text-secondary">
        {{ t('dishes.loading') }}
      </p>
      <div v-else-if="errorMessage" class="flex flex-1 items-center justify-center px-2">
        <p role="alert" class="rounded-xl border border-danger/40 bg-danger/15 px-4 py-3 text-sm font-semibold text-white">
          {{ errorMessage }}
        </p>
      </div>
      <template v-else>
        <p v-if="actionError" role="alert" class="rounded-xl border border-danger/40 bg-danger/15 px-4 py-3 text-sm font-semibold text-white">
          {{ actionError }}
        </p>
        <DishSection
          data-testid="dishes-in-list"
          :title="t('dishes.inList')"
          :list-label="t('dishes.inListAria')"
          :empty-text="t('dishes.inListEmpty')"
          :dishes="groups.inList"
          variant="in-list"
          :shopping-list-id="shoppingListId"
          @action="onInListAction"
        />
        <DishSection
          data-testid="dishes-suggested"
          :title="t('dishes.suggested')"
          :list-label="t('dishes.suggestedAria')"
          :empty-text="suggestedEmptyText"
          :dishes="groups.suggested"
          variant="suggested"
          :shopping-list-id="shoppingListId"
          @action="onSuggestedAction"
        />
        <PausedSection
          v-if="groups.paused.length > 0"
          v-model:expanded="pausedExpanded"
          :dishes="groups.paused"
          :shopping-list-id="shoppingListId"
          @resume="onResume"
        />
      </template>
    </main>

    <ListSectionsDock :shopping-list-id="shoppingListId" :shopping-list-name="shoppingListName" current="list-dishes">
      <RouterLink
        :to="{ name: 'list-dish-new', params: { id: shoppingListId } }"
        class="flex h-13.5 items-center justify-center gap-2.5 rounded-full bg-brand-500 text-lg font-extrabold text-white no-underline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" aria-hidden="true">
          <path d="M12 5v14 M5 12h14" />
        </svg>
        {{ t('dishes.newDish') }}
      </RouterLink>
    </ListSectionsDock>
  </div>
</template>
