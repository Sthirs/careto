<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import ItemIcon from '@/components/list-items/ItemIcon.vue';
import { SECTION_ICONS } from '@/lib/itemIcons';

const GRIP =
  'M9 6.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z M15 6.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z M9 13.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z M15 13.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z M9 20.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z M15 20.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z';

/** One store section on the Store sections screen, moved by its grip. */
const props = defineProps<{
  sectionKey: string;
  position: number;
  total: number;
  itemCount: number;
  /** Being dragged, and by how far. */
  dragging: boolean;
  dragY: number;
  /** A drop here lands above this row (or below it, for the last row). */
  dropAbove: boolean;
  dropBelow: boolean;
}>();

const emit = defineEmits<{ grab: [event: PointerEvent]; moveBy: [delta: -1 | 1] }>();

const { t } = useI18n();

const name = computed(() => t(`catalog.sections.${props.sectionKey}`));
const rowStyle = computed(() =>
  props.dragging ? { transform: `translateY(${props.dragY}px) scale(1.03)` } : undefined,
);

const onKeydown = (event: KeyboardEvent) => {
  if (event.key === 'ArrowUp' && props.position > 1) {
    event.preventDefault();
    emit('moveBy', -1);
  } else if (event.key === 'ArrowDown' && props.position < props.total) {
    event.preventDefault();
    emit('moveBy', 1);
  }
};
</script>

<template>
  <li
    data-section-row
    data-testid="store-section"
    :data-section-key="sectionKey"
    class="relative flex min-h-16 items-center gap-3.5 rounded-xl pr-1.5 pl-3.5"
    :class="dragging ? 'z-10 bg-[#4A5A66] shadow-[0_12px_28px_rgba(0,0,0,0.45)]' : 'bg-surface transition-transform duration-(--duration-fast-02)'"
    :style="rowStyle"
  >
    <span v-if="dropAbove" aria-hidden="true" data-testid="drop-line" class="absolute inset-x-1.5 -top-1 h-1 rounded-sm bg-accent"></span>
    <span v-if="dropBelow" aria-hidden="true" data-testid="drop-line" class="absolute inset-x-1.5 -bottom-1 h-1 rounded-sm bg-accent"></span>
    <span class="w-6.5 text-right text-[15px] font-extrabold text-text-muted tabular-nums">{{ position }}</span>
    <span aria-hidden="true" class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-danger text-white">
      <ItemIcon :path="SECTION_ICONS[sectionKey] ?? ''" :size="28" :stroke-width="1.5" />
    </span>
    <span class="flex min-w-0 flex-1 flex-col">
      <span class="text-[17px] font-extrabold">{{ name }}</span>
      <span class="text-[13px] font-bold text-text-muted">{{ t('storeSections.itemCount', { count: itemCount }, itemCount) }}</span>
    </span>
    <button
      type="button"
      data-testid="section-grip"
      class="flex h-12 w-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-[10px] text-[#C4CDD4] focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-accent"
      :aria-label="t('storeSections.gripAria', { name, position, total })"
      @pointerdown="emit('grab', $event)"
      @keydown="onKeydown"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path :d="GRIP" /></svg>
    </button>
  </li>
</template>
