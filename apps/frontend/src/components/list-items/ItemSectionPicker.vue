<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

import ItemIcon from '@/components/list-items/ItemIcon.vue';
import { SECTION_ICONS } from '@/lib/itemIcons';

/** The "Store section" view of the item menu: one radio per store section. */
const props = defineProps<{
  itemName: string;
  /** The sections to offer, in the list's order, without "Own items". */
  sectionKeys: string[];
  currentKey: string | null;
}>();

const emit = defineEmits<{ cancel: []; save: [sectionKey: string] }>();

const { t } = useI18n();

const picked = ref<string | null>(props.currentKey);

const save = () => {
  if (picked.value && picked.value !== props.currentKey) emit('save', picked.value);
  else emit('cancel');
};
</script>

<template>
  <div class="flex h-[640px] max-h-[85dvh] flex-col gap-3.5 px-4" data-testid="item-section-picker">
    <div data-sheet-drag>
      <h2 class="m-0 text-[22px] font-extrabold">{{ t('itemMenu.sectionTitle', { name: itemName }) }}</h2>
      <p class="mt-0.5 mb-0 text-sm font-bold text-text-muted">{{ t('itemMenu.sectionSubtitle') }}</p>
    </div>
    <ul
      role="radiogroup"
      :aria-label="t('itemMenu.sectionsAria')"
      class="m-0 flex min-h-0 flex-1 list-none flex-col gap-1 overflow-y-auto p-0 pr-1"
    >
      <li v-for="key in sectionKeys" :key="key">
        <button
          type="button"
          role="radio"
          data-testid="section-choice"
          :aria-checked="key === picked"
          class="flex min-h-15 w-full items-center gap-3.5 rounded-xl pr-3.5 pl-2.5 text-left text-white focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-accent"
          :class="key === picked ? 'bg-[#4A5A66]' : 'bg-surface'"
          @click="picked = key"
        >
          <span aria-hidden="true" class="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-danger">
            <ItemIcon :path="SECTION_ICONS[key] ?? ''" :size="26" :stroke-width="1.5" />
          </span>
          <span class="flex-1 text-[17px] font-extrabold">{{ t(`catalog.sections.${key}`) }}</span>
          <span
            aria-hidden="true"
            class="flex size-5.5 shrink-0 items-center justify-center rounded-full border-2"
            :class="key === picked ? 'border-accent' : 'border-outline'"
          >
            <span class="size-2.5 rounded-full" :class="key === picked ? 'bg-accent' : ''"></span>
          </span>
        </button>
      </li>
    </ul>
    <div class="flex shrink-0 gap-2.5">
      <button
        type="button"
        class="h-13.5 flex-1 rounded-full border-2 border-outline text-lg font-extrabold text-white focus-visible:outline-3 focus-visible:outline-accent"
        @click="emit('cancel')"
      >
        {{ t('itemMenu.cancel') }}
      </button>
      <button
        type="button"
        class="h-13.5 flex-1 rounded-full bg-brand-500 text-lg font-extrabold text-white focus-visible:outline-3 focus-visible:outline-accent"
        @click="save"
      >
        {{ t('itemMenu.saveSection') }}
      </button>
    </div>
  </div>
</template>
