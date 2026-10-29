<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { RouterLink } from 'vue-router';

import { DISH_ICON } from '@/lib/dishIcons';

export type ListSection = 'list-detail' | 'list-dishes' | 'list-week' | 'list-settings';

defineProps<{
  shoppingListId: string;
  // Forwarded as history state so the target screen can title itself before
  // its own fetch resolves.
  shoppingListName?: string;
  current: ListSection;
}>();

const { t } = useI18n();

// Sections are siblings (ADR-0022): switching tab replaces the history entry,
// so Back from any section lands on My lists, like the header back arrow.

// Icon paths copied from the design's tab bar (24 × 24 line style).
const SECTIONS: ReadonlyArray<{ name: ListSection; labelKey: string; path: string }> = [
  { name: 'list-detail', labelKey: 'listSections.list', path: 'M9 6h11 M9 12h11 M9 18h11 M4.5 6h.01 M4.5 12h.01 M4.5 18h.01' },
  { name: 'list-dishes', labelKey: 'listSections.dishes', path: DISH_ICON },
  { name: 'list-week', labelKey: 'listSections.week', path: 'M4 6h16v14H4z M4 10h16 M8 3v4 M16 3v4' },
  { name: 'list-settings', labelKey: 'listSections.settings', path: 'M4 7h10 M18 7h2 M4 17h2 M10 17h10 M16 5v4 M8 15v4' },
];
</script>

<template>
  <nav :aria-label="t('listSections.navAria')" class="grid grid-cols-4 pt-0.5">
    <RouterLink
      v-for="section in SECTIONS"
      :key="section.name"
      :to="{ name: section.name, params: { id: shoppingListId }, state: { shoppingListName } }"
      replace
      :aria-current="section.name === current ? 'page' : undefined"
      class="flex min-h-13 flex-col items-center justify-center gap-1 rounded-xl text-[13px] font-bold no-underline focus-visible:outline-3 focus-visible:outline-accent"
      :class="section.name === current ? 'text-accent' : 'text-white hover:text-text-secondary'"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path :d="section.path" />
      </svg>
      {{ t(section.labelKey) }}
    </RouterLink>
  </nav>
</template>
