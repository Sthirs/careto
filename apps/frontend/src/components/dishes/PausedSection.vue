<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import DishCard from '@/components/dishes/DishCard.vue';
import type { Dish } from '@/types/dish';

defineProps<{ dishes: Dish[]; shoppingListId: string }>();

const expanded = defineModel<boolean>('expanded', { required: true });

const emit = defineEmits<{ resume: [dish: Dish] }>();

const { t } = useI18n();
</script>

<template>
  <section class="flex flex-col gap-2.5" data-testid="paused-dishes">
    <button
      type="button"
      class="flex min-h-12 items-center gap-2 text-left text-white focus-visible:outline-3 focus-visible:outline-accent"
      :aria-expanded="expanded"
      @click="expanded = !expanded"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path :d="expanded ? 'M6 9l6 6 6-6' : 'M9 6l6 6-6 6'" />
      </svg>
      <span class="text-[22px] font-extrabold">{{ t('dishes.paused') }}</span>
      <span class="text-base font-bold text-text-muted" data-testid="paused-count">{{ dishes.length }}</span>
    </button>
    <ul v-if="expanded" :aria-label="t('dishes.pausedAria')" class="m-0 grid list-none grid-cols-2 gap-2.5 p-0">
      <DishCard
        v-for="dish in dishes"
        :key="dish.id"
        :dish="dish"
        variant="paused"
        :shopping-list-id="shoppingListId"
        @action="emit('resume', dish)"
      />
    </ul>
  </section>
</template>
