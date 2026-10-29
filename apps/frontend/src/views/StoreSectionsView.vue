<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import AccountAvatarLink from '@/components/AccountAvatarLink.vue';
import ScreenHeader from '@/components/ScreenHeader.vue';
import StoreSectionRow from '@/components/store-sections/StoreSectionRow.vue';
import { useSectionDrag } from '@/composables/useSectionDrag';
import { useStoreSections } from '@/composables/useStoreSections';
import { goBackTo } from '@/lib/backNavigation';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const shoppingListId = computed(() => route.params.id as string);
const isLoading = ref(true);
const errorMessage = ref('');
const announcement = ref('');
const listRef = ref<HTMLElement | null>(null);
const scrollerRef = ref<HTMLElement | null>(null);

const { order, itemCounts, isSaving, load, move, reset, save } = useStoreSections(
  () => shoppingListId.value,
);
const drag = useSectionDrag(listRef, scrollerRef, (from, insertAt) => move(from, insertAt));

const sectionName = (key: string) => t(`catalog.sections.${key}`);

// Keyboard moves keep focus on the moved row's grip and say where it went.
const moveBy = async (index: number, delta: -1 | 1) => {
  const key = order.value[index];
  move(index, delta === 1 ? index + 2 : index - 1);
  const position = index + delta + 1;
  announcement.value = t('storeSections.movedAnnouncement', {
    name: sectionName(key),
    position,
    total: order.value.length,
  });
  await nextTick();
  listRef.value
    ?.querySelector<HTMLElement>(`[data-section-key="${key}"] [data-testid="section-grip"]`)
    ?.focus();
};

const goBack = () => {
  goBackTo(router, { name: 'list-settings', params: { id: shoppingListId.value } });
};

const saveOrder = async () => {
  errorMessage.value = '';
  try {
    await save();
    goBack();
  } catch {
    errorMessage.value = t('storeSections.saveFailed');
  }
};

onMounted(async () => {
  try {
    await load();
  } catch {
    errorMessage.value = t('storeSections.loadFailed');
  } finally {
    isLoading.value = false;
  }
});
</script>

<template>
  <div class="relative mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col overflow-hidden">
    <ScreenHeader :title="t('storeSections.title')" :back-label="t('storeSections.backToSettings')" compact @back="goBack">
      <template #trailing><AccountAvatarLink /></template>
    </ScreenHeader>
    <p class="mx-5 mt-1 mb-3 text-[15px] leading-[1.4] font-semibold text-text-secondary">{{ t('storeSections.intro') }}</p>

    <main ref="scrollerRef" class="flex min-h-0 flex-1 flex-col overflow-y-auto pr-2.5 pb-[120px] pl-4">
      <p v-if="isLoading" class="flex flex-1 items-center justify-center text-text-secondary">
        {{ t('storeSections.loading') }}
      </p>
      <template v-else-if="order.length > 0">
        <ol
          ref="listRef"
          :aria-label="t('storeSections.listAria')"
          data-testid="store-sections"
          class="m-0 flex list-none flex-col gap-1 p-0 select-none"
          @pointermove="drag.onPointerMove"
          @pointerup="drag.onPointerEnd"
          @pointercancel="drag.onPointerEnd"
        >
          <StoreSectionRow
            v-for="(key, index) in order"
            :key="key"
            :section-key="key"
            :position="index + 1"
            :total="order.length"
            :item-count="itemCounts.get(key) ?? 0"
            :dragging="drag.dragIndex.value === index"
            :drag-y="drag.dragY.value"
            :drop-above="drag.overIndex.value === index && drag.dragIndex.value !== index"
            :drop-below="index === order.length - 1 && drag.overIndex.value === order.length && drag.dragIndex.value !== index"
            @grab="drag.onPointerDown(index, $event)"
            @move-by="moveBy(index, $event)"
          />
        </ol>
        <button
          type="button"
          class="mt-4 h-11 self-start px-1 text-[15px] font-extrabold text-accent focus-visible:outline-3 focus-visible:outline-accent"
          @click="reset"
        >
          {{ t('storeSections.reset') }}
        </button>
      </template>
      <p v-if="errorMessage" role="alert" class="mt-3 rounded-xl border border-danger/40 bg-danger/15 px-4 py-3 text-sm font-semibold text-white">
        {{ errorMessage }}
      </p>
      <p class="sr-only" aria-live="polite">{{ announcement }}</p>
    </main>

    <div class="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-3 rounded-t-[22px] bg-sheet px-4 pt-2.5 pb-6 shadow-[0_-8px_24px_rgba(0,0,0,0.35)]">
      <span aria-hidden="true" class="h-[5px] w-12 self-center rounded-full bg-divider"></span>
      <button
        type="button"
        class="h-13.5 rounded-full bg-brand-500 text-lg font-extrabold text-white transition enabled:hover:bg-brand-600 focus-visible:outline-3 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="isLoading || isSaving || order.length === 0"
        @click="saveOrder"
      >
        {{ t('storeSections.save') }}
      </button>
    </div>
  </div>
</template>
