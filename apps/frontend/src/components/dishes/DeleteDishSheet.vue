<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import BottomSheet from '@/components/BottomSheet.vue';
import DishArt from '@/components/dishes/DishArt.vue';

defineProps<{ open: boolean; dishId: string; dishName: string; imageUrl: string | null; isDeleting: boolean }>();

const emit = defineEmits<{ close: []; confirm: [] }>();

const { t } = useI18n();
</script>

<template>
  <BottomSheet :open="open" :label="t('dishes.deleteTitle', { name: dishName })" @close="emit('close')">
    <div class="flex flex-col gap-3.5 px-4 pt-1" data-testid="delete-sheet">
      <div class="flex items-center gap-3.5" data-sheet-drag>
        <span aria-hidden="true" class="size-14 shrink-0 overflow-hidden rounded-xl">
          <DishArt :dish-id="dishId" :image-url="imageUrl" :icon-size="34" />
        </span>
        <h2 class="m-0 text-[22px] font-extrabold">{{ t('dishes.deleteTitle', { name: dishName }) }}</h2>
      </div>
      <p class="m-0 text-base leading-[1.4] font-semibold text-text-secondary">{{ t('dishes.deleteBody') }}</p>
      <div class="flex gap-2.5">
        <button
          type="button"
          class="h-13.5 flex-1 rounded-full border-2 border-outline text-lg font-extrabold text-white focus-visible:outline-3 focus-visible:outline-accent"
          @click="emit('close')"
        >
          {{ t('dishes.keep') }}
        </button>
        <button
          type="button"
          class="h-13.5 flex-1 rounded-full bg-danger text-lg font-extrabold text-white focus-visible:outline-3 focus-visible:outline-accent disabled:opacity-50"
          :disabled="isDeleting"
          @click="emit('confirm')"
        >
          {{ t('dishes.delete') }}
        </button>
      </div>
    </div>
  </BottomSheet>
</template>
