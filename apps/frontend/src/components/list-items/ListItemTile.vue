<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import ItemIcon from '@/components/list-items/ItemIcon.vue';
import { DISH_ICON } from '@/lib/dishIcons';

const props = defineProps<{
  label: string;
  icon: string;
  tone: 'to-buy' | 'bought';
  /** Accessible name of the tap action ("Mark Milk as bought"). */
  actionLabel: string;
  /** Id of the element explaining swipe / Delete to remove. */
  describedBy: string;
  /** The item is to buy because of a dish (`source: 'dish'`). */
  fromDish?: boolean;
  /** Accessible name of the ⋮ button; without it the tile has no menu. */
  menuLabel?: string;
}>();

const emit = defineEmits<{ activate: []; remove: []; menu: [] }>();

const MENU_DOTS =
  'M12 7.5a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6z M12 13.8a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6z M12 20.1a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6z';

const { t } = useI18n();

/** A swipe further left than this share of the tile's width removes it. */
const REMOVE_THRESHOLD = 0.35;
/** Movement below this many px is still a tap. */
const DRAG_SLOP = 8;

const offset = ref(0);
const isDragging = ref(false);
let pointerId: number | null = null;
let startX = 0;
let startY = 0;
let width = 0;
let axis: 'x' | 'y' | null = null;
let swallowClick = false;

const tileStyle = computed(() => ({ transform: `translateX(${offset.value}px)` }));

const onPointerDown = (event: PointerEvent) => {
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  pointerId = event.pointerId;
  startX = event.clientX;
  startY = event.clientY;
  width = (event.currentTarget as HTMLElement).offsetWidth;
  axis = null;
};

const onPointerMove = (event: PointerEvent) => {
  if (event.pointerId !== pointerId) return;
  const dx = event.clientX - startX;
  const dy = event.clientY - startY;
  if (!axis) {
    if (Math.abs(dx) < DRAG_SLOP && Math.abs(dy) < DRAG_SLOP) return;
    axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    if (axis === 'x') (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  }
  if (axis !== 'x') return;
  isDragging.value = true;
  offset.value = Math.min(0, dx);
};

const onPointerEnd = (event: PointerEvent) => {
  if (event.pointerId !== pointerId) return;
  pointerId = null;
  isDragging.value = false;
  if (axis !== 'x') return;
  swallowClick = true;
  if (width > 0 && -offset.value > width * REMOVE_THRESHOLD) {
    offset.value = -width;
    emit('remove');
    return;
  }
  offset.value = 0;
};

/** The click that ends a swipe is not a tap. */
const isSwipeClick = () => {
  const swallowed = swallowClick;
  swallowClick = false;
  return swallowed;
};

const onClick = () => {
  if (!isSwipeClick()) emit('activate');
};

const onMenuClick = () => {
  if (!isSwipeClick()) emit('menu');
};

const onKeydown = (event: KeyboardEvent) => {
  if (event.key !== 'Delete' && event.key !== 'Backspace') return;
  event.preventDefault();
  emit('remove');
};

const toneClass = computed(() => (props.tone === 'to-buy' ? 'bg-danger' : 'bg-brand-500'));
</script>

<template>
  <li
    class="relative touch-pan-y overflow-hidden select-none"
    data-testid="list-item"
    :data-tone="tone"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerEnd"
    @pointercancel="onPointerEnd"
  >
    <div aria-hidden="true" class="absolute inset-0 flex items-center justify-end bg-ink pr-6 text-white">
      <ItemIcon path="M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13 M10 11v6 M14 11v6" :size="28" :stroke-width="2" />
    </div>
    <div
      class="relative flex min-h-18 items-center"
      :class="[toneClass, isDragging ? '' : 'transition-transform duration-(--duration-fast-02) ease-(--ease-standard-productive)']"
      :style="tileStyle"
    >
      <button
        type="button"
        class="flex min-w-0 flex-1 items-center gap-4.5 self-stretch pl-5.5 text-left text-white focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-accent"
        :class="menuLabel ? '' : 'pr-5.5'"
        :aria-label="actionLabel"
        :aria-describedby="describedBy"
        aria-keyshortcuts="Delete"
        @click="onClick"
        @keydown="onKeydown"
      >
        <ItemIcon :path="icon" />
        <span class="min-w-0 truncate text-[19px] font-extrabold">{{ label }}</span>
        <span
          v-if="fromDish"
          role="img"
          data-testid="from-dish-badge"
          :aria-label="t('shoppingListDetail.fromDish')"
          :title="t('shoppingListDetail.fromDish')"
          class="-ml-2 flex size-6.5 shrink-0 items-center justify-center rounded-full bg-white/22"
        >
          <ItemIcon :path="DISH_ICON" :size="15" :stroke-width="2.4" />
        </span>
      </button>
      <button
        v-if="menuLabel"
        type="button"
        data-testid="item-menu-button"
        class="mr-2 flex size-13 shrink-0 items-center justify-center rounded-full focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-accent"
        :aria-label="menuLabel"
        aria-haspopup="dialog"
        @click="onMenuClick"
      >
        <span class="flex size-8 items-center justify-center rounded-full bg-white/45 text-[#8E1F25]">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path :d="MENU_DOTS" />
          </svg>
        </span>
      </button>
    </div>
  </li>
</template>
