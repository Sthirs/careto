<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import BottomSheet from '@/components/BottomSheet.vue';

/** Confirms clearing every slot of the week plan. */
defineProps<{ open: boolean; count: number }>();

const emit = defineEmits<{ close: []; confirm: [] }>();

const { t } = useI18n();
</script>

<template>
  <BottomSheet :open="open" :label="t('week.newPlanTitle')" @close="emit('close')">
    <div class="flex flex-col gap-3.5 px-4 pt-1" data-testid="new-plan-sheet">
      <h2 class="m-0 text-[22px] font-extrabold" data-sheet-drag>{{ t('week.newPlanTitle') }}</h2>
      <p class="m-0 text-base leading-[1.4] font-semibold text-text-secondary">
        {{ t('week.newPlanBody', { count }) }}
      </p>
      <div class="flex gap-2.5">
        <button
          type="button"
          class="h-13.5 flex-1 rounded-full border-2 border-outline text-lg font-extrabold text-white focus-visible:outline-3 focus-visible:outline-accent"
          @click="emit('close')"
        >
          {{ t('common.cancel') }}
        </button>
        <button
          type="button"
          class="h-13.5 flex-1 rounded-full bg-danger text-lg font-extrabold text-white focus-visible:outline-3 focus-visible:outline-accent"
          @click="emit('confirm')"
        >
          {{ t('week.clearAll') }}
        </button>
      </div>
    </div>
  </BottomSheet>
</template>
