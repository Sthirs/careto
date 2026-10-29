<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import BottomSheet from '@/components/BottomSheet.vue';
import DishArt from '@/components/dishes/DishArt.vue';
import ItemSearchField from '@/components/list-items/ItemSearchField.vue';
import SheetHeader from '@/components/SheetHeader.vue';
import { rankDishes } from '@/lib/weekPlan';
import type { Dish } from '@/types/dish';

/** Bottom sheet that picks the dish of one slot, searchable by name. */
const props = defineProps<{ open: boolean; slotName: string; dishes: Dish[]; current: Dish | null }>();

const emit = defineEmits<{ close: []; choose: [dish: Dish]; clear: [] }>();

const { t, locale } = useI18n();

const query = ref('');
const hasQuery = computed(() => query.value.trim().length > 0);
const choices = computed(() => rankDishes(props.dishes, query.value, locale.value));
const title = computed(() => t('week.pickerTitle', { slot: props.slotName }));

// Each opening starts with an empty search.
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) query.value = '';
  },
);
</script>

<template>
  <BottomSheet :open="open" :label="title" @close="emit('close')">
    <div class="flex h-[560px] max-h-[80dvh] flex-col" data-testid="week-picker">
      <SheetHeader :close-label="t('common.close')" @close="emit('close')">
        <div>
          <h2 class="m-0 text-xl font-extrabold">{{ title }}</h2>
          <p v-if="current" class="mt-0.5 mb-0 text-sm font-bold text-text-muted">
            {{ t('week.now', { dish: current.name }) }}
          </p>
        </div>
      </SheetHeader>
      <div class="flex min-h-0 flex-1 flex-col gap-3 px-4 pt-3">
        <p v-if="dishes.length === 0" class="m-0 px-1 py-5 text-center text-base font-bold text-text-muted">
          {{ t('week.noDishes') }}
        </p>
        <p v-else-if="hasQuery && choices.length === 0" class="m-0 px-1 py-5 text-center text-base font-bold text-text-muted">
          {{ t('week.noMatches', { query: query.trim() }) }}
        </p>
        <ul class="m-0 mb-auto flex min-h-0 list-none flex-col gap-1 overflow-y-auto rounded-xl p-0 pr-1" :aria-label="t('week.dishesAria')">
          <li v-for="dish in choices" :key="dish.id">
            <button
              type="button"
              data-testid="week-choice"
              :data-dish-name="dish.name"
              :aria-current="dish.id === current?.id ? 'true' : undefined"
              class="flex min-h-16 w-full items-center gap-3.5 rounded-xl px-3 py-2 text-left text-white focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-accent"
              :class="dish.id === current?.id ? 'bg-brand-500' : 'bg-surface'"
              @click="emit('choose', dish)"
            >
              <span aria-hidden="true" class="size-12 shrink-0 overflow-hidden rounded-[10px]">
                <DishArt :dish-id="dish.id" :image-url="dish.imageUrl" :icon-size="28" />
              </span>
              <span class="flex-1 text-[17px] font-extrabold">{{ dish.name }}</span>
            </button>
          </li>
          <li v-if="current && !hasQuery">
            <button
              type="button"
              class="mt-1.5 min-h-13 w-full rounded-xl border-2 border-danger bg-transparent text-base font-extrabold text-[#FFB4B0] focus-visible:outline-3 focus-visible:outline-accent"
              @click="emit('clear')"
            >
              {{ t('week.removeFromSlot') }}
            </button>
          </li>
        </ul>
        <div class="shrink-0">
          <ItemSearchField
            v-model="query"
            input-id="week-dish-search"
            :label="t('week.searchLabel')"
            :placeholder="t('week.searchPlaceholder')"
          />
        </div>
      </div>
    </div>
  </BottomSheet>
</template>
