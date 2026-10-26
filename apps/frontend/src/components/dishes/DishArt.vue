<script setup lang="ts">
import { computed } from 'vue';

import { dishArtFor } from '@/lib/dishIcons';

/** The dish's photo, or its default art when it has none. Decorative. */
const props = withDefaults(defineProps<{ dishId: string; imageUrl: string | null; iconSize?: number }>(), {
  iconSize: 72,
});

const art = computed(() => dishArtFor(props.dishId));
</script>

<template>
  <img v-if="imageUrl" :src="imageUrl" alt="" class="block h-full w-full object-cover" />
  <div v-else class="flex h-full w-full items-center justify-center" :style="{ background: art.background }">
    <svg
      :width="iconSize"
      :height="iconSize"
      viewBox="0 0 24 24"
      fill="none"
      stroke="rgba(255,255,255,0.55)"
      stroke-width="1.1"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path :d="art.path" />
    </svg>
  </div>
</template>
