<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import ItemIcon from '@/components/list-items/ItemIcon.vue';

defineProps<{
  /** "Paused until 9 Nov", or null when the dish is not paused. */
  pausedLabel: string | null;
  lastAddedLabel: string;
}>();

const emit = defineEmits<{ pause: []; resume: []; delete: [] }>();

const { t } = useI18n();
</script>

<template>
  <section class="flex flex-col gap-2.5">
    <h2 class="m-0 text-[22px] font-extrabold">{{ t('dishes.rotation') }}</h2>
    <ul class="m-0 flex list-none flex-col gap-1 overflow-hidden rounded-xl p-0">
      <li>
        <div v-if="pausedLabel" class="flex min-h-18 items-center gap-4 bg-[#27323B] pr-2.5 pl-4.5">
          <ItemIcon path="M8 5v14 M16 5v14" :size="28" :stroke-width="2" class="text-accent" />
          <span class="flex flex-1 flex-col">
            <span class="text-lg font-extrabold">{{ pausedLabel }}</span>
            <span class="text-sm font-semibold text-[#C4CDD4]">{{ t('dishes.pausedHint') }}</span>
          </span>
          <button
            type="button"
            class="h-10 rounded-full border-[1.5px] border-accent px-3.5 text-sm font-extrabold text-accent focus-visible:outline-3 focus-visible:outline-accent"
            @click="emit('resume')"
          >
            {{ t('dishes.resume') }}
          </button>
        </div>
        <button
          v-else
          type="button"
          class="flex min-h-18 w-full items-center gap-4 bg-surface pr-4 pl-4.5 text-left text-white focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-accent"
          @click="emit('pause')"
        >
          <ItemIcon path="M8 5v14 M16 5v14" :size="28" :stroke-width="2" />
          <span class="flex flex-1 flex-col">
            <span class="text-lg font-extrabold">{{ t('dishes.pauseDish') }}</span>
            <span class="text-sm font-semibold text-[#C4CDD4]">{{ lastAddedLabel }}</span>
          </span>
          <ItemIcon path="M9 6l6 6-6 6" :size="20" :stroke-width="2.4" class="text-[#C4CDD4]" />
        </button>
      </li>
      <li>
        <button
          type="button"
          class="flex min-h-18 w-full items-center gap-4 bg-surface pr-4 pl-4.5 text-left text-[#FFB4B0] focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-accent"
          @click="emit('delete')"
        >
          <ItemIcon path="M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13 M10 11v6 M14 11v6" :size="28" :stroke-width="2" />
          <span class="flex-1 text-lg font-extrabold">{{ t('dishes.deleteDish') }}</span>
        </button>
      </li>
    </ul>
  </section>
</template>
