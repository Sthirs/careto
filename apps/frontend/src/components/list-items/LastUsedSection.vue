<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import ListItemTile from '@/components/list-items/ListItemTile.vue';

export type TileView = { id: string; label: string; icon: string };

defineProps<{ items: TileView[]; describedBy: string }>();

const expanded = defineModel<boolean>('expanded', { required: true });

const emit = defineEmits<{ addBack: [id: string]; remove: [id: string] }>();

const { t } = useI18n();
</script>

<template>
  <section class="flex flex-col gap-2.5" data-testid="last-used">
    <button
      type="button"
      class="flex min-h-12 items-center gap-2 text-left text-white focus-visible:outline-3 focus-visible:outline-accent"
      :aria-expanded="expanded"
      @click="expanded = !expanded"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path :d="expanded ? 'M6 9l6 6 6-6' : 'M9 6l6 6-6 6'" />
      </svg>
      <span class="text-[22px] font-extrabold">{{ t('shoppingListDetail.lastUsed') }}</span>
    </button>
    <ul
      v-if="expanded"
      :aria-label="t('shoppingListDetail.lastUsed')"
      class="m-0 flex list-none flex-col gap-1 overflow-hidden rounded-xl p-0"
    >
      <ListItemTile
        v-for="item in items"
        :key="item.id"
        tone="bought"
        :label="item.label"
        :icon="item.icon"
        :action-label="t('shoppingListDetail.addBackAria', { name: item.label })"
        :described-by="describedBy"
        @activate="emit('addBack', item.id)"
        @remove="emit('remove', item.id)"
      />
    </ul>
  </section>
</template>
