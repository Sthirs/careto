<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import ItemIcon from '@/components/list-items/ItemIcon.vue';
import type { IngredientEntry } from '@/composables/useDishForm';

defineProps<{ ingredients: IngredientEntry[] }>();

const emit = defineEmits<{ remove: [key: string] }>();

const { t } = useI18n();
</script>

<template>
  <ul
    v-if="ingredients.length > 0"
    :aria-label="t('dishes.ingredients')"
    data-testid="dish-ingredients"
    class="m-0 flex list-none flex-col gap-1 overflow-hidden rounded-xl p-0"
  >
    <li
      v-for="entry in ingredients"
      :key="entry.key"
      class="flex min-h-16 items-center gap-4 bg-surface pr-1.5 pl-4.5"
    >
      <ItemIcon :path="entry.icon" :size="34" :stroke-width="1.5" />
      <span class="min-w-0 flex-1 text-lg font-extrabold">{{ entry.label }}</span>
      <button
        type="button"
        class="flex size-11 items-center justify-center rounded-full text-[#C4CDD4] focus-visible:outline-3 focus-visible:outline-accent"
        :aria-label="t('dishes.removeIngredientAria', { name: entry.label })"
        @click="emit('remove', entry.key)"
      >
        <ItemIcon path="M6 6l12 12 M18 6L6 18" :size="20" :stroke-width="2.4" />
      </button>
    </li>
  </ul>
  <p
    v-else
    class="m-0 rounded-xl border-2 border-dashed border-outline p-5 text-center text-[15px] font-bold text-text-muted"
  >
    {{ t('dishes.noIngredients') }}
  </p>
</template>
