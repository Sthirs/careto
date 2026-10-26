<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import BottomSheet from '@/components/BottomSheet.vue';
import { addDays, addMonths, formatWeekdayDate, toIsoDate } from '@/lib/dishDates';

const props = defineProps<{ open: boolean; dishName: string }>();

const emit = defineEmits<{ close: []; confirm: [pausedUntil: string] }>();

const { t, locale } = useI18n();

type Choice = 'w1' | 'w2' | 'm1' | 'pick';

const today = () => new Date();
const choice = ref<Choice>('w2');
const pickedDate = ref('');
const minDate = computed(() => toIsoDate(addDays(today(), 1)));

const presets = computed(() => [
  { id: 'w1' as const, label: t('dishes.oneWeek'), iso: toIsoDate(addDays(today(), 7)) },
  { id: 'w2' as const, label: t('dishes.twoWeeks'), iso: toIsoDate(addDays(today(), 14)) },
  { id: 'm1' as const, label: t('dishes.oneMonth'), iso: toIsoDate(addMonths(today(), 1)) },
]);

const options = computed(() => [
  ...presets.value.map((preset) => ({ ...preset, hint: formatWeekdayDate(preset.iso, locale.value) })),
  { id: 'pick' as const, label: t('dishes.pickDate'), iso: '', hint: choice.value === 'pick' ? '' : t('dishes.anyDay') },
]);

const chosenIso = computed(() =>
  choice.value === 'pick' ? pickedDate.value : (presets.value.find((p) => p.id === choice.value)?.iso ?? ''),
);
const canConfirm = computed(() => chosenIso.value >= minDate.value);

// Each opening starts from the default choice.
watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return;
    choice.value = 'w2';
    pickedDate.value = toIsoDate(addMonths(today(), 1));
  },
  { immediate: true },
);
</script>

<template>
  <BottomSheet :open="open" :label="t('dishes.pauseTitle', { name: dishName })" @close="emit('close')">
    <div class="flex flex-col gap-3.5 px-4 pt-1" data-testid="pause-sheet">
      <div data-sheet-drag>
        <h2 class="m-0 text-[22px] font-extrabold">{{ t('dishes.pauseTitle', { name: dishName }) }}</h2>
        <p class="mt-1 mb-0 text-[15px] font-semibold text-[#C4CDD4]">{{ t('dishes.pauseBody') }}</p>
      </div>
      <div
        role="radiogroup"
        :aria-label="t('dishes.pauseUntilAria')"
        class="flex flex-col gap-1 overflow-hidden rounded-xl"
      >
        <button
          v-for="option in options"
          :key="option.id"
          type="button"
          role="radio"
          :aria-checked="choice === option.id"
          class="flex min-h-15 w-full items-center gap-3.5 px-4 text-left text-white focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-accent"
          :class="choice === option.id ? 'bg-[#3F5A58]' : 'bg-surface'"
          @click="choice = option.id"
        >
          <span
            class="flex size-[22px] shrink-0 items-center justify-center rounded-full border-2"
            :class="choice === option.id ? 'border-accent' : 'border-text-muted'"
          >
            <span class="size-2.5 rounded-full" :class="choice === option.id ? 'bg-accent' : 'bg-transparent'"></span>
          </span>
          <span class="flex-1 text-[17px] font-extrabold">{{ option.label }}</span>
          <span class="text-[15px] font-bold text-[#C4CDD4]">{{ option.hint }}</span>
        </button>
      </div>
      <div v-if="choice === 'pick'" class="flex flex-col gap-1.5">
        <label for="pause-date" class="pl-1 text-sm font-extrabold text-text-secondary">{{ t('dishes.pausedUntilLabel') }}</label>
        <input
          id="pause-date"
          v-model="pickedDate"
          type="date"
          :min="minDate"
          class="h-13 rounded-xl bg-white px-4 text-[17px] text-ink [color-scheme:light] focus:outline-3 focus:outline-offset-1 focus:outline-accent"
        />
      </div>
      <div class="flex gap-2.5">
        <button
          type="button"
          class="h-13.5 flex-1 rounded-full border-2 border-outline text-lg font-extrabold text-white focus-visible:outline-3 focus-visible:outline-accent"
          @click="emit('close')"
        >
          {{ t('dishes.cancel') }}
        </button>
        <button
          type="button"
          class="h-13.5 flex-1 rounded-full bg-brand-500 text-lg font-extrabold text-white focus-visible:outline-3 focus-visible:outline-accent disabled:opacity-50"
          :disabled="!canConfirm"
          @click="emit('confirm', chosenIso)"
        >
          {{ t('dishes.pause') }}
        </button>
      </div>
    </div>
  </BottomSheet>
</template>
