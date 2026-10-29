<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

export type AddPlanState = 'idle' | 'adding' | 'added';

/**
 * "Add ingredients to list": pressed, then "Adding…" while the request runs,
 * then "Added to the list" for a moment. Disabled with nothing planned.
 */
const props = defineProps<{ state: AddPlanState; disabled: boolean }>();

const emit = defineEmits<{ add: [] }>();

const { t } = useI18n();

const label = computed(
  () => ({ idle: t('week.addToList'), adding: t('week.adding'), added: t('week.added') })[props.state],
);
</script>

<template>
  <button
    type="button"
    data-testid="add-plan-to-list"
    :data-state="state"
    :disabled="disabled || state === 'adding'"
    class="flex h-13.5 items-center justify-center gap-2.5 rounded-full text-lg font-extrabold text-white transition-[background-color,scale] duration-(--duration-fast-02) ease-(--ease-standard-productive) not-disabled:active:scale-[0.97] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-default"
    :class="[
      state === 'added' ? 'bg-brand-600' : 'bg-brand-500 not-disabled:active:bg-brand-600',
      disabled && state === 'idle' ? 'opacity-50' : '',
    ]"
    @click="emit('add')"
  >
    <svg
      v-if="state === 'adding'"
      class="animate-spin motion-reduce:animate-none"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.8"
      stroke-linecap="round"
      aria-hidden="true"
    >
      <path d="M12 3a9 9 0 1 1-9 9" />
    </svg>
    <svg v-else width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M5 12l5 5 9-10" />
    </svg>
    {{ label }}
  </button>
</template>
