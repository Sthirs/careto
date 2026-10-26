<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import ItemIcon from '@/components/list-items/ItemIcon.vue';
import type { SearchResult } from '@/composables/useItemSearch';

const props = withDefaults(
  defineProps<{
    results: SearchResult[];
    /** Where a taken result already is: on the list, or among a dish's ingredients. */
    takenIn?: 'list' | 'dish';
  }>(),
  { takenIn: 'list' },
);

const emit = defineEmits<{ pick: [result: SearchResult] }>();

const { t } = useI18n();

const hasMatches = computed(() => props.results.some((result) => !result.isNewCustom));

const ariaLabelOf = (result: SearchResult) => {
  if (result.isNewCustom) return t('shoppingListDetail.addCustomAria', { name: result.label });
  if (result.taken) {
    return props.takenIn === 'dish'
      ? t('dishes.alreadyIngredientAria', { name: result.label })
      : t('shoppingListDetail.alreadyInListAria', { name: result.label });
  }
  return t('shoppingListDetail.addItemAria', { name: result.label });
};
</script>

<template>
  <div class="flex flex-col gap-2">
    <span class="pl-1 text-sm font-extrabold text-text-muted" aria-live="polite">
      {{ hasMatches ? t('shoppingListDetail.matchingItems') : t('shoppingListDetail.noMatches') }}
    </span>
    <ul
      :aria-label="t('shoppingListDetail.resultsAria')"
      class="m-0 flex max-h-[min(440px,50vh)] list-none flex-col gap-1 overflow-y-auto rounded-xl p-0"
    >
      <li v-for="result in results" :key="result.id">
        <button
          type="button"
          class="flex min-h-16 w-full items-center gap-4 pr-2.5 pl-4.5 text-left text-white focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-accent"
          :class="result.isNewCustom ? 'rounded-xl border-2 border-dashed border-outline bg-transparent' : 'bg-surface'"
          :aria-label="ariaLabelOf(result)"
          :aria-disabled="result.taken || undefined"
          data-testid="search-result"
          @click="!result.taken && emit('pick', result)"
        >
          <ItemIcon :path="result.icon" :size="34" :stroke-width="1.5" />
          <span class="flex min-w-0 flex-1 flex-col">
            <span class="truncate text-lg font-extrabold">{{ result.label }}</span>
            <span v-if="result.isNewCustom" class="text-[13px] font-bold text-text-muted">
              {{ t('shoppingListDetail.addAsCustom') }}
            </span>
          </span>
          <span
            v-if="result.taken && takenIn === 'dish'"
            class="flex h-8 items-center rounded-full bg-[#243039] px-3 text-[13px] font-extrabold text-accent"
          >
            {{ t('dishes.added') }}
          </span>
          <span v-else-if="result.taken" class="flex h-8 items-center rounded-full bg-danger px-3 text-[13px] font-extrabold">
            {{ t('shoppingListDetail.inList') }}
          </span>
          <span v-else class="flex size-9.5 shrink-0 items-center justify-center rounded-full bg-brand-500">
            <ItemIcon path="M12 5v14 M5 12h14" :size="20" :stroke-width="2.8" />
          </span>
        </button>
      </li>
    </ul>
  </div>
</template>
