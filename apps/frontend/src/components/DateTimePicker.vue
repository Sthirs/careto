<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { DatePicker } from 'v-calendar';

import BottomSheet from '@/components/BottomSheet.vue';
import SheetHeader from '@/components/SheetHeader.vue';
import { useRoutedOverlay } from '@/composables/useRoutedOverlay';

const { t } = useI18n();

interface Props {
  modelValue: string;
}

interface Emits {
  (e: 'update:modelValue', value: string): void;
  (e: 'close'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// Compute today's ISO date once in setup (not per-render).
const todayIso = new Date().toISOString().slice(0, 10);

const {
  isOpen,
  open: openOverlay,
  close: closeOverlay,
} = useRoutedOverlay('date');
const draft = ref(props.modelValue || todayIso);

// Reset draft to the committed modelValue whenever the sheet opens, so a
// Cancel just discards in-flight day clicks without emitting.
watch(isOpen, (open) => {
  if (open) {
    draft.value = props.modelValue || todayIso;
  }
});

const selectAttribute = computed(() => ({
  highlight: { color: '#4E9A8B', fillMode: 'solid' as const },
  content: { color: '#FFFFFF', fontWeight: 700 },
}));

function formatDate(ymd: string): string {
  const value = ymd || todayIso;
  const d = new Date(value + 'T00:00:00');
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function openSheet(): void {
  draft.value = props.modelValue || todayIso;
  openOverlay();
}

function apply(): void {
  const value = draft.value; // capture before closing
  closeOverlay();
  emit('update:modelValue', value);
  emit('close');
}

function cancel(): void {
  closeOverlay();
  emit('close');
}
</script>

<template>
  <div
    data-test-id="dtp"
    class="flex flex-col gap-1.5 cursor-pointer"
    @click="openSheet"
  >
    <span
      class="font-display text-[10px] font-medium uppercase tracking-[0.05em] text-[#D3DAE0]"
      >{{ t('dateTimePicker.dateLabel') }}</span
    >
    <div
      class="rounded-xl px-4 py-3 bg-[#222C34] border border-[rgba(90,103,114,0.5)] flex items-center justify-between gap-3"
    >
      <span class="flex items-center gap-3 min-w-0">
        <svg
          viewBox="0 0 16 17"
          class="h-4 w-4 shrink-0 fill-current text-[#D3DAE0]"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M4 1.5v2M12 1.5v2M1.5 6.5h13M3 3.5h10A1.5 1.5 0 0 1 14.5 5v9A1.5 1.5 0 0 1 13 15.5H3A1.5 1.5 0 0 1 1.5 14V5A1.5 1.5 0 0 1 3 3.5z"
            stroke="#D3DAE0"
            stroke-width="1.2"
            fill="none"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <span class="text-sm text-[#FFFFFF] truncate">{{
          formatDate(modelValue)
        }}</span>
      </span>
      <svg
        viewBox="0 0 12 8"
        class="h-3 w-3 shrink-0 fill-current text-[#D3DAE0]"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M1 1l5 5 5-5"
          stroke="#D3DAE0"
          stroke-width="1.5"
          fill="none"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </div>
  </div>

  <BottomSheet
    :open="isOpen"
    :center-on-desktop="false"
    :label="t('dateTimePicker.selectDateAria')"
    panel-class="w-full max-w-[390px] bg-[#222C34] rounded-t-[24px] border-t border-[rgba(255,255,255,0.1)] shadow-[0_-10px_40px_rgba(0,0,0,0.5)]"
    @close="cancel"
  >
    <!-- Outer Header -->
    <SheetHeader :close-label="t('common.close')" @close="cancel">
      <div class="flex flex-col">
        <span
          class="font-display text-[10px] font-medium uppercase tracking-[0.05em] text-[#8ED9C9]"
          >{{ t('dateTimePicker.selectDateHeading') }}</span
        >
        <span class="text-2xl font-bold text-[#FFFFFF]">{{
          formatDate(draft)
        }}</span>
      </div>
    </SheetHeader>
    <!-- v-calendar DatePicker (INLINE, no popover slot). The `.string`
         v-model modifier is REQUIRED: v-calendar 3.1.2 derives the emitted
         value type only from modelModifiers (model-config is ignored), and
         without it the day-click emits a Date object instead of a string. -->
    <div class="px-5 py-2">
      <DatePicker
        v-model.string="draft"
        mode="date"
        is-dark
        :color="'#4E9A8B'"
        :first-day-of-week="1"
        :masks="{ title: 'MMMM YYYY', modelValue: 'YYYY-MM-DD' }"
        :select-attribute="selectAttribute"
        trim-weeks
        borderless
      />
    </div>
    <!-- Footer Actions -->
    <div
      class="flex justify-end gap-2 px-5 py-4 border-t border-[rgba(255,255,255,0.05)]"
    >
      <button
        type="button"
        class="rounded-full px-6 py-3 text-[12px] font-medium tracking-[0.05em] text-[#D3DAE0]"
        @click="cancel"
      >
        {{ t('dateTimePicker.cancel') }}
      </button>
      <button
        type="button"
        class="rounded-full px-6 py-3 text-[12px] font-medium tracking-[0.05em] text-[#FFFFFF] bg-[#4E9A8B]"
        @click="apply"
      >
        {{ t('dateTimePicker.apply') }}
      </button>
    </div>
  </BottomSheet>
</template>

<style scoped>
/* Make calendar container bg transparent (sheet bg shows through) */
:deep(.vc-container) {
  background: transparent !important;
}

/* Weekday cells: single uppercase letters, compact */
:deep(.vc-weekday) {
  color: #D3DAE0;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.05em;
}

/* Day cell content */
:deep(.vc-day-content) {
  color: #FFFFFF;
  font-size: 16px;
  line-height: 24px;
  border-radius: 9999px;
  min-height: 46px;
  min-width: 46px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Trailing/leading month days (dimmed) */
:deep(.vc-day.is-not-in-month .vc-day-content) {
  color: #5A6772;
}

/* Selected day highlight */
:deep(.vc-highlight) {
  background: #4E9A8B !important;
  border-radius: 9999px !important;
  width: 100%;
  height: 100%;
}

/* Nav arrows */
:deep(.vc-nav-arrow) {
  color: #D3DAE0;
}

/* Month title */
:deep(.vc-title) {
  color: #FFFFFF;
  font-size: 16px;
  font-weight: 600;
}

/* Header padding */
:deep(.vc-header) {
  padding: 8px 0;
}
</style>
