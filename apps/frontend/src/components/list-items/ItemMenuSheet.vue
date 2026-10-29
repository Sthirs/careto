<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import BottomSheet from '@/components/BottomSheet.vue';
import ItemIcon from '@/components/list-items/ItemIcon.vue';
import ItemIconPicker from '@/components/list-items/ItemIconPicker.vue';
import ItemSectionPicker from '@/components/list-items/ItemSectionPicker.vue';

/** What the item menu shows about the item it was opened for. */
export type ItemMenuTarget = {
  name: string;
  icon: string;
  isCustom: boolean;
  /** The icon picked before, or the catalog item's own key. */
  iconKey: string | null;
  /** The section the item is sorted under; "own-items" when not sorted yet. */
  sectionKey: string;
};

const OWN_ITEMS = 'own-items';
const ICON_ACTION = 'M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M17 14v6 M14 17h6';
const SECTION_ACTION = 'M8 6h12 M8 12h12 M8 18h12 M3 9l1.5-3L6 9 M3 15l1.5 3L6 15';
const REMOVE_ACTION = 'M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13 M10 11v6 M14 11v6';
const CHEVRON = 'M9 6l6 6-6 6';

/** The ⋮ sheet of a list item: remove it, or change its icon or section (ADR-0026). */
const props = defineProps<{
  open: boolean;
  target: ItemMenuTarget | null;
  /** The list's section order, used for the section picker. */
  sectionOrder: string[];
}>();

const emit = defineEmits<{
  close: [];
  remove: [];
  saveIcon: [iconKey: string];
  saveSection: [sectionKey: string];
}>();

const { t } = useI18n();

const view = ref<'actions' | 'icon' | 'section'>('actions');

// Each opening starts on the actions.
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) view.value = 'actions';
  },
);

// Saving or cancelling a picker goes back to the actions, which show any change.
const saveIcon = (iconKey: string) => {
  view.value = 'actions';
  emit('saveIcon', iconKey);
};

const saveSection = (sectionKey: string) => {
  view.value = 'actions';
  emit('saveSection', sectionKey);
};

const sortedSection = computed(() =>
  props.target && props.target.sectionKey !== OWN_ITEMS ? props.target.sectionKey : null,
);
const sectionLabel = computed(() =>
  sortedSection.value ? t(`catalog.sections.${sortedSection.value}`) : t('itemMenu.notSorted'),
);
const kind = computed(() => {
  const base = props.target?.isCustom ? t('itemMenu.customItem') : t('itemMenu.catalogItem');
  return sortedSection.value ? `${base} · ${sectionLabel.value}` : base;
});
const sectionKeys = computed(() => props.sectionOrder.filter((key) => key !== OWN_ITEMS));
const label = computed(() => {
  const name = props.target?.name ?? '';
  if (view.value === 'icon') return t('itemMenu.iconTitle', { name });
  if (view.value === 'section') return t('itemMenu.sectionTitle', { name });
  return t('itemMenu.title', { name });
});
</script>

<template>
  <BottomSheet :open="open && target !== null" :label="label" @close="emit('close')">
    <template v-if="target">
      <ItemIconPicker
        v-if="view === 'icon'"
        :item-name="target.name"
        :current-icon="target.icon"
        :current-key="target.iconKey"
        @cancel="view = 'actions'"
        @save="saveIcon"
      />
      <ItemSectionPicker
        v-else-if="view === 'section'"
        :item-name="target.name"
        :section-keys="sectionKeys"
        :current-key="sortedSection"
        @cancel="view = 'actions'"
        @save="saveSection"
      />
      <div v-else class="flex flex-col gap-3.5 px-4 pt-1" data-testid="item-menu">
        <div class="flex items-center gap-3.5" data-sheet-drag>
          <span aria-hidden="true" class="flex size-14 shrink-0 items-center justify-center rounded-[14px] bg-danger text-white">
            <ItemIcon :path="target.icon" :size="34" :stroke-width="1.5" />
          </span>
          <div class="min-w-0">
            <h2 class="m-0 truncate text-[22px] font-extrabold">{{ target.name }}</h2>
            <p class="mt-0.5 mb-0 text-sm font-bold text-text-muted">{{ kind }}</p>
          </div>
        </div>
        <ul class="m-0 flex list-none flex-col gap-1 overflow-hidden rounded-xl p-0">
          <li>
            <button
              type="button"
              class="flex min-h-16 w-full items-center gap-4 bg-surface pr-4 pl-4.5 text-left text-lg font-extrabold text-white focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-accent"
              @click="view = 'icon'"
            >
              <ItemIcon :path="ICON_ACTION" :size="26" :stroke-width="2" />
              <span class="flex-1">{{ t('itemMenu.changeIcon') }}</span>
              <ItemIcon :path="CHEVRON" :size="20" :stroke-width="2.4" class="text-[#C4CDD4]" />
            </button>
          </li>
          <li>
            <button
              type="button"
              class="flex min-h-16 w-full items-center gap-4 bg-surface pr-4 pl-4.5 text-left text-white focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-accent"
              @click="view = 'section'"
            >
              <ItemIcon :path="SECTION_ACTION" :size="26" :stroke-width="2" />
              <span class="flex flex-1 flex-col">
                <span class="text-lg font-extrabold">{{ t('itemMenu.storeSection') }}</span>
                <span class="text-sm font-semibold text-[#C4CDD4]">{{ sectionLabel }}</span>
              </span>
              <ItemIcon :path="CHEVRON" :size="20" :stroke-width="2.4" class="text-[#C4CDD4]" />
            </button>
          </li>
          <li>
            <button
              type="button"
              class="flex min-h-16 w-full items-center gap-4 bg-surface pr-4 pl-4.5 text-left text-lg font-extrabold text-[#FFB4B0] focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-accent"
              @click="emit('remove')"
            >
              <ItemIcon :path="REMOVE_ACTION" :size="26" :stroke-width="2" />
              <span class="flex-1">{{ t('itemMenu.remove') }}</span>
            </button>
          </li>
        </ul>
      </div>
    </template>
  </BottomSheet>
</template>
