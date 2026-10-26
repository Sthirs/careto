<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import DishArt from '@/components/dishes/DishArt.vue';
import ItemIcon from '@/components/list-items/ItemIcon.vue';
import type { Dish } from '@/types/dish';

export type DishCardVariant = 'in-list' | 'suggested' | 'paused';

const props = defineProps<{ dish: Dish; variant: DishCardVariant; shoppingListId: string }>();

const emit = defineEmits<{ action: [] }>();

const { t } = useI18n();

const editRoute = computed(() => ({
  name: 'list-dish',
  params: { id: props.shoppingListId, dishId: props.dish.id },
}));

const actionLabel = computed(() => {
  if (props.variant === 'in-list') return t('dishes.undoAria', { name: props.dish.name });
  if (props.variant === 'paused') return t('dishes.resumeAria', { name: props.dish.name });
  return t('dishes.addAria', { name: props.dish.name });
});

const CARD_CLASS: Record<DishCardVariant, string> = {
  'in-list': 'bg-danger',
  suggested: 'bg-surface',
  paused: 'bg-[#27323B] outline-1 -outline-offset-1 outline-dashed outline-divider',
};
</script>

<template>
  <li
    class="relative flex aspect-square flex-col overflow-hidden rounded-[14px]"
    :class="CARD_CLASS[variant]"
    data-testid="dish-card"
    :data-dish-name="dish.name"
  >
    <!-- The ⋮ link below is the accessible way in; this one only widens the tap target. -->
    <RouterLink
      :to="editRoute"
      tabindex="-1"
      aria-hidden="true"
      class="min-h-0 flex-1"
      :class="{ 'opacity-45 grayscale-[0.7]': variant === 'paused' }"
    >
      <DishArt :dish-id="dish.id" :image-url="dish.imageUrl" />
    </RouterLink>
    <div class="flex h-14 shrink-0 items-center gap-0.5 pr-0.5">
      <p
        class="m-0 line-clamp-2 min-w-0 flex-1 pl-3 text-base leading-[1.2] font-extrabold"
        :class="{ 'text-[#C4CDD4]': variant === 'paused' }"
      >
        {{ dish.name }}
      </p>
      <RouterLink
        :to="editRoute"
        :aria-label="t('dishes.editAria', { name: dish.name })"
        class="flex size-11 shrink-0 items-center justify-center rounded-full text-white focus-visible:outline-3 focus-visible:outline-accent"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 7.5a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6z M12 13.8a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6z M12 20.1a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6z" />
        </svg>
      </RouterLink>
    </div>
    <button
      type="button"
      class="absolute top-1 right-1 flex size-12 items-center justify-center rounded-full p-0 focus-visible:outline-3 focus-visible:outline-accent"
      :aria-label="actionLabel"
      @click="emit('action')"
    >
      <span
        v-if="variant === 'paused'"
        class="flex size-9 items-center justify-center rounded-full border-[1.5px] border-accent bg-brand-900 text-accent"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
      </span>
      <span
        v-else
        class="flex size-9 items-center justify-center rounded-full text-white shadow-[0_2px_8px_rgba(0,0,0,0.3)]"
        :class="variant === 'in-list' ? 'bg-danger' : 'bg-brand-500'"
      >
        <ItemIcon v-if="variant === 'in-list'" path="M5 12l5 5 9-10" :size="18" :stroke-width="3" />
        <ItemIcon v-else path="M12 5v14 M5 12h14" :size="20" :stroke-width="2.8" />
      </span>
    </button>
  </li>
</template>
