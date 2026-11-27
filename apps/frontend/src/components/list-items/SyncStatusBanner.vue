<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

// Tells the member the list is working from the device (ADR-0030): offline,
// or online but the server cannot be reached, with the changes still waiting.
const props = defineProps<{
  online: boolean;
  waiting: boolean;
  pendingCount: number;
}>();

const { t } = useI18n();

const visible = computed(() => !props.online || props.waiting);
const message = computed(() =>
  props.online ? t('shoppingListDetail.unreachable') : t('shoppingListDetail.offline'),
);
</script>

<template>
  <div role="status" aria-live="polite" class="shrink-0 empty:hidden">
    <div
      v-if="visible"
      data-testid="sync-status"
      class="flex items-start gap-3 rounded-xl border border-outline bg-surface px-4 py-3 text-sm text-text-primary"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        class="mt-0.5 h-5 w-5 shrink-0 text-text-accent"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M2 2l20 20M8.5 16.5a5 5 0 0 1 7 0M5 12.9a10 10 0 0 1 5.2-2.8M19 12.9a10 10 0 0 0-2.4-1.7M2 8.8a15 15 0 0 1 4.2-2.6M22 8.8A15 15 0 0 0 11 5M12 20h.01" />
      </svg>
      <p class="m-0 flex flex-col gap-1">
        <span class="font-semibold">{{ message }}</span>
        <span v-if="pendingCount > 0" data-testid="sync-pending" class="text-text-secondary">
          {{ t('shoppingListDetail.pendingChanges', { count: pendingCount }, pendingCount) }}
        </span>
      </p>
    </div>
  </div>
</template>
