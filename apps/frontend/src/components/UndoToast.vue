<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue';
import { useI18n } from 'vue-i18n';

/** How long a toast stays before it dismisses itself. */
const TOAST_MS = 6000;

/** A status message with an Undo action, shown above the section dock. */
const props = defineProps<{ text: string }>();

const emit = defineEmits<{ undo: []; dismiss: [] }>();

const { t } = useI18n();

let timer: ReturnType<typeof setTimeout> | undefined;

// Every new message restarts the countdown.
watch(
  () => props.text,
  () => {
    clearTimeout(timer);
    timer = setTimeout(() => emit('dismiss'), TOAST_MS);
  },
  { immediate: true },
);

onBeforeUnmount(() => clearTimeout(timer));
</script>

<template>
  <div
    role="status"
    data-testid="undo-toast"
    class="absolute inset-x-4 bottom-[196px] z-20 flex min-h-14 items-center gap-3 rounded-[14px] bg-[#141A1F] py-1.5 pr-1.5 pl-4 shadow-[0_8px_24px_rgba(0,0,0,0.4)]"
  >
    <span class="flex-1 text-[15px] leading-[1.3] font-bold">{{ text }}</span>
    <button
      type="button"
      class="h-11 rounded-full px-3.5 text-base font-extrabold text-accent focus-visible:outline-3 focus-visible:outline-accent"
      @click="emit('undo')"
    >
      {{ t('common.undo') }}
    </button>
  </div>
</template>
