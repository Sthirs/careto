<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import AccountAvatarLink from '@/components/AccountAvatarLink.vue';
import DeleteDishSheet from '@/components/dishes/DeleteDishSheet.vue';
import DishIngredients from '@/components/dishes/DishIngredients.vue';
import DishPhotoPicker from '@/components/dishes/DishPhotoPicker.vue';
import DishRotation from '@/components/dishes/DishRotation.vue';
import PauseDishSheet from '@/components/dishes/PauseDishSheet.vue';
import ItemSearchField from '@/components/list-items/ItemSearchField.vue';
import ItemSearchResults from '@/components/list-items/ItemSearchResults.vue';
import ScreenHeader from '@/components/ScreenHeader.vue';
import { useDishForm } from '@/composables/useDishForm';
import { useImageUpload } from '@/composables/useImageUpload';
import { useItemCatalog } from '@/composables/useItemCatalog';
import { useItemSearch, type SearchResult } from '@/composables/useItemSearch';
import { useListItems } from '@/composables/useListItems';
import { useRoutedOverlay } from '@/composables/useRoutedOverlay';
import { goBackTo } from '@/lib/backNavigation';
import { formatAgo, formatShortDate, toIsoDate } from '@/lib/dishDates';

const { t, locale } = useI18n();
const route = useRoute();
const router = useRouter();

const shoppingListId = computed(() => route.params.id as string);
const dishId = computed(() => (route.name === 'list-dish' ? (route.params.dishId as string) : undefined));
const isEdit = computed(() => dishId.value !== undefined);

const isLoading = ref(isEdit.value);
const errorMessage = ref('');
const actionError = ref('');
const isDeleting = ref(false);
const query = ref('');

const form = useDishForm(() => shoppingListId.value, () => dishId.value);
const { name, ingredients, imageUrl, pausedUntil, lastAddedAt, isSaving, canSave } = form;
const { catalog, loadCatalog } = useItemCatalog();
const { customItems, overrides, loadItems } = useListItems(() => shoppingListId.value);
const results = useItemSearch(query, catalog, customItems, form.takenKeys, overrides);
const pauseSheet = useRoutedOverlay('pause-dish');
const deleteSheet = useRoutedOverlay('delete-dish');

const { isUploading, uploadError, handleFileChange } = useImageUpload((file) => form.pickImage(file), {
  invalidType: () => t('account.changePhotoErrorInvalid'),
  tooLarge: () => t('account.changePhotoErrorTooLarge'),
  uploadFailed: () => t('account.changePhotoErrorGeneric'),
});

const isPaused = computed(() => pausedUntil.value !== null && pausedUntil.value > toIsoDate(new Date()));
const pausedLabel = computed(() =>
  isPaused.value ? t('dishes.pausedUntil', { date: formatShortDate(pausedUntil.value as string, locale.value) }) : null,
);
const lastAddedLabel = computed(() =>
  lastAddedAt.value
    ? t('dishes.lastAdded', { when: formatAgo(lastAddedAt.value, locale.value) })
    : t('dishes.neverAdded'),
);

// Back, Cancel, Save and Delete all land on Dishes (ADR-0019).
const goBack = () => {
  goBackTo(router, { name: 'list-dishes', params: { id: shoppingListId.value } });
};

const run = async (action: () => Promise<unknown>) => {
  actionError.value = '';
  try {
    await action();
    return true;
  } catch {
    actionError.value = t('dishes.actionFailed');
    return false;
  }
};

const pick = (result: SearchResult) => {
  query.value = '';
  form.addIngredient(result);
};

const save = async () => {
  if (await run(form.save)) goBack();
};

const confirmPause = async (until: string) => {
  pauseSheet.close();
  await run(() => form.setPause(until));
};

const resume = () => run(() => form.setPause(null));

const confirmDelete = async () => {
  isDeleting.value = true;
  const deleted = await run(form.remove);
  isDeleting.value = false;
  if (!deleted) return;
  // Pop the sheet's own entry first, so the pop below returns to Dishes.
  await deleteSheet.closeAndSettle();
  goBack();
};

onMounted(async () => {
  try {
    await Promise.all([form.load(), loadCatalog(), loadItems()]);
  } catch {
    errorMessage.value = t('dishes.loadFailed');
  } finally {
    isLoading.value = false;
  }
});
</script>

<template>
  <div class="relative mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col overflow-hidden">
    <ScreenHeader :title="isEdit ? t('dishes.editTitle') : t('dishes.newTitle')" :back-label="t('dishes.backToDishes')" @back="goBack">
      <template #trailing><AccountAvatarLink /></template>
    </ScreenHeader>

    <main class="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 pt-3 pb-[130px]">
      <p v-if="isLoading" class="flex flex-1 items-center justify-center text-text-secondary">{{ t('dishes.loading') }}</p>
      <div v-else-if="errorMessage" class="flex flex-1 items-center justify-center px-2">
        <p role="alert" class="rounded-xl border border-danger/40 bg-danger/15 px-4 py-3 text-sm font-semibold text-white">{{ errorMessage }}</p>
      </div>
      <template v-else>
        <p v-if="actionError" role="alert" class="rounded-xl border border-danger/40 bg-danger/15 px-4 py-3 text-sm font-semibold text-white">
          {{ actionError }}
        </p>
        <DishPhotoPicker
          :art-id="dishId ?? 'new-dish'"
          :dish-name="name"
          :image-url="imageUrl"
          :paused-label="pausedLabel ?? undefined"
          :is-uploading="isUploading"
          :upload-error="uploadError"
          @change="handleFileChange"
        />

        <div class="flex flex-col gap-1.5">
          <label for="dish-name" class="pl-1 text-sm font-extrabold text-text-secondary">{{ t('dishes.nameLabel') }}</label>
          <input
            id="dish-name"
            v-model="name"
            type="text"
            maxlength="80"
            :placeholder="t('dishes.namePlaceholder')"
            class="h-13 rounded-xl bg-white px-4 text-[17px] text-ink placeholder:text-[#6B7680] focus:outline-3 focus:outline-offset-1 focus:outline-accent"
          />
        </div>

        <section class="flex flex-col gap-2.5">
          <h2 class="m-0 text-[22px] font-extrabold">
            {{ t('dishes.ingredients') }} <span class="text-base text-text-muted">{{ ingredients.length }}</span>
          </h2>
          <ItemSearchField v-model="query" :label="t('dishes.searchLabel')" :placeholder="t('dishes.searchPlaceholder')" />
          <ItemSearchResults v-if="query.trim()" :results="results" taken-in="dish" @pick="pick" />
          <DishIngredients :ingredients="ingredients" @remove="form.removeIngredient" />
        </section>

        <DishRotation
          v-if="isEdit"
          :paused-label="pausedLabel"
          :last-added-label="lastAddedLabel"
          @pause="pauseSheet.open"
          @resume="resume"
          @delete="deleteSheet.open"
        />
      </template>
    </main>

    <div class="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-3 rounded-t-[22px] bg-sheet px-4 pt-2.5 pb-6 shadow-[0_-8px_24px_rgba(0,0,0,0.35)]">
      <span aria-hidden="true" class="h-[5px] w-12 self-center rounded-full bg-divider"></span>
      <div class="flex gap-2.5">
        <button
          v-if="!isEdit"
          type="button"
          class="h-13.5 flex-1 rounded-full border-2 border-outline text-lg font-extrabold text-white focus-visible:outline-3 focus-visible:outline-accent"
          @click="goBack"
        >
          {{ t('dishes.cancel') }}
        </button>
        <button
          type="button"
          class="h-13.5 flex-1 rounded-full bg-brand-500 text-lg font-extrabold text-white focus-visible:outline-3 focus-visible:outline-accent disabled:opacity-50"
          :disabled="!canSave"
          @click="save"
        >
          {{ isSaving ? t('dishes.saving') : isEdit ? t('dishes.saveChanges') : t('dishes.save') }}
        </button>
      </div>
    </div>

    <template v-if="isEdit && dishId">
      <PauseDishSheet :open="pauseSheet.isOpen.value" :dish-name="name" @close="pauseSheet.close" @confirm="confirmPause" />
      <DeleteDishSheet
        :open="deleteSheet.isOpen.value"
        :dish-id="dishId"
        :dish-name="name"
        :image-url="imageUrl"
        :is-deleting="isDeleting"
        @close="deleteSheet.close"
        @confirm="confirmDelete"
      />
    </template>
  </div>
</template>
