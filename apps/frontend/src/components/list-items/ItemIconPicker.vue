<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import ItemIcon from '@/components/list-items/ItemIcon.vue';
import ItemSearchField from '@/components/list-items/ItemSearchField.vue';
import { ITEM_ICONS } from '@/lib/itemIcons';

/** The "Change icon" view of the item menu: a searchable grid of catalog icons. */
const props = defineProps<{ itemName: string; currentIcon: string; currentKey: string | null }>();

const emit = defineEmits<{ cancel: []; save: [iconKey: string] }>();

const { t, locale } = useI18n();

const query = ref('');
const picked = ref<string | null>(props.currentKey);

const icons = computed(() => {
  const needle = query.value.trim().toLocaleLowerCase(locale.value);
  return Object.keys(ITEM_ICONS)
    .map((key) => ({ key, label: t(`catalog.items.${key}`), path: ITEM_ICONS[key] }))
    .filter((icon) => !needle || icon.label.toLocaleLowerCase(locale.value).includes(needle))
    .sort((a, b) => a.label.localeCompare(b.label, locale.value));
});
const previewPath = computed(() => (picked.value && ITEM_ICONS[picked.value]) || props.currentIcon);

const save = () => {
  if (picked.value && picked.value !== props.currentKey) emit('save', picked.value);
  else emit('cancel');
};
</script>

<template>
  <div class="flex h-[640px] max-h-[85dvh] flex-col gap-3.5 px-4" data-testid="item-icon-picker">
    <div class="flex items-center gap-3.5" data-sheet-drag>
      <span aria-hidden="true" class="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-danger text-white">
        <ItemIcon :path="previewPath" />
      </span>
      <div class="min-w-0 flex-1">
        <h2 class="m-0 text-[22px] font-extrabold">{{ t('itemMenu.iconTitle', { name: itemName }) }}</h2>
        <p class="mt-0.5 mb-0 text-sm font-bold text-text-muted">{{ t('itemMenu.iconSubtitle') }}</p>
      </div>
    </div>
    <ItemSearchField
      v-model="query"
      input-id="item-icon-search"
      :label="t('itemMenu.iconSearchLabel')"
      :placeholder="t('itemMenu.iconSearchPlaceholder')"
    />
    <p v-if="icons.length === 0" class="m-0 text-center text-[15px] font-bold text-text-muted">
      {{ t('itemMenu.noIcons', { query: query.trim() }) }}
    </p>
    <ul
      role="listbox"
      :aria-label="t('itemMenu.iconsAria')"
      class="m-0 grid min-h-0 flex-1 list-none grid-cols-4 content-start gap-2 overflow-y-auto p-0 pr-1"
    >
      <li v-for="icon in icons" :key="icon.key" role="option" :aria-selected="icon.key === picked">
        <button
          type="button"
          data-testid="icon-choice"
          :title="icon.label"
          class="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-[14px] border-3 p-1 text-white focus-visible:outline-3 focus-visible:outline-accent"
          :class="icon.key === picked ? 'border-accent bg-brand-500' : 'border-transparent bg-surface'"
          @click="picked = icon.key"
        >
          <ItemIcon :path="icon.path" :size="34" :stroke-width="1.5" />
          <span class="max-w-full truncate text-center text-[11px] leading-[1.1] font-bold">{{ icon.label }}</span>
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
        {{ t('itemMenu.saveIcon') }}
      </button>
    </div>
  </div>
</template>
