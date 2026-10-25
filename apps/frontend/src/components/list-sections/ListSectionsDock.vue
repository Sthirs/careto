<script setup lang="ts">
import ListSectionsNav, { type ListSection } from '@/components/list-sections/ListSectionsNav.vue';

defineProps<{
  shoppingListId: string;
  shoppingListName?: string;
  current: ListSection;
}>();
</script>

<template>
  <div
    class="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-3 rounded-t-[22px] bg-sheet px-4 pt-2.5 pb-4.5 shadow-[0_-8px_24px_rgba(0,0,0,0.35)]"
  >
    <span aria-hidden="true" class="h-[5px] w-12 self-center rounded-full bg-divider"></span>
    <slot />
    <ListSectionsNav
      :shopping-list-id="shoppingListId"
      :shopping-list-name="shoppingListName"
      :current="current"
    />
  </div>
</template>
