<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import DishArt from '@/components/dishes/DishArt.vue';
import type { Dish } from '@/types/dish';

/** One square meal slot of the week: the planned dish, or "Add a dish". */
defineProps<{ dish: Dish | null; mealLabel: string; slotName: string }>();

const emit = defineEmits<{ pick: []; remove: [] }>();

const { t } = useI18n();
</script>

<template>
  <div v-if="dish" class="relative" data-testid="week-slot" :data-slot="slotName" :data-dish-name="dish.name">
    <button
      type="button"
      class="flex aspect-square w-full flex-col overflow-hidden rounded-[14px] bg-surface p-0 text-left text-white hover:brightness-108 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent"
      :aria-label="t('week.slotAria', { slot: slotName, dish: dish.name })"
      @click="emit('pick')"
    >
      <span class="relative min-h-0 w-full flex-1">
        <DishArt :dish-id="dish.id" :image-url="dish.imageUrl" :icon-size="56" />
        <span class="absolute top-2.5 left-2.5 flex h-6.5 items-center rounded-full bg-[rgba(20,26,31,0.7)] px-2.5 pt-0.5 text-[13px] leading-none font-extrabold">
          {{ mealLabel }}
        </span>
      </span>
      <span class="line-clamp-2 h-14 w-full shrink-0 px-3 py-[9px] text-base leading-[1.2] font-extrabold">{{ dish.name }}</span>
    </button>
    <button
      type="button"
      class="absolute top-1 right-1 flex size-11 items-center justify-center p-0 focus-visible:outline-3 focus-visible:outline-accent"
      :aria-label="t('week.removeAria', { slot: slotName, dish: dish.name })"
      @click="emit('remove')"
    >
      <span class="flex size-8 items-center justify-center rounded-full bg-[rgba(20,26,31,0.75)] text-white">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" aria-hidden="true">
          <path d="M6 6l12 12 M18 6L6 18" />
        </svg>
      </span>
    </button>
  </div>
  <button
    v-else
    type="button"
    data-testid="week-slot"
    :data-slot="slotName"
    data-empty="true"
    class="flex aspect-square w-full flex-col overflow-hidden rounded-[14px] bg-transparent p-0 text-left text-[#C4CDD4] hover:brightness-108 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent"
    :aria-label="t('week.addDishAria', { slot: slotName })"
    @click="emit('pick')"
  >
    <span class="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-2.5 rounded-t-[14px] border-2 border-b-0 border-dashed border-outline">
      <span class="flex size-12 items-center justify-center rounded-full bg-brand-500 text-white">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" aria-hidden="true">
          <path d="M12 5v14 M5 12h14" />
        </svg>
      </span>
      <span class="text-[15px] font-extrabold">{{ mealLabel }}</span>
    </span>
    <span class="line-clamp-2 h-14 w-full shrink-0 bg-[#27323B] px-3 py-[9px] text-base leading-[1.2] font-extrabold text-text-muted">
      {{ t('week.addDish') }}
    </span>
  </button>
</template>
