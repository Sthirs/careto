<script setup lang="ts">
import DishCard, { type DishCardVariant } from '@/components/dishes/DishCard.vue';
import type { Dish } from '@/types/dish';

/** One always-visible section of the Dishes screen; says so when it is empty. */
defineProps<{
  title: string;
  listLabel: string;
  emptyText: string;
  dishes: Dish[];
  variant: DishCardVariant;
  shoppingListId: string;
}>();

const emit = defineEmits<{ action: [dish: Dish] }>();
</script>

<template>
  <section class="flex flex-col gap-2.5">
    <h2 class="m-0 text-[22px] font-extrabold">{{ title }}</h2>
    <ul
      v-if="dishes.length > 0"
      :aria-label="listLabel"
      class="m-0 grid list-none grid-cols-2 gap-2.5 p-0"
    >
      <DishCard
        v-for="dish in dishes"
        :key="dish.id"
        :dish="dish"
        :variant="variant"
        :shopping-list-id="shoppingListId"
        @action="emit('action', dish)"
      />
    </ul>
    <p
      v-else
      class="m-0 rounded-xl border-2 border-dashed border-outline p-5 text-center text-[15px] font-bold text-text-muted"
    >
      {{ emptyText }}
    </p>
  </section>
</template>
