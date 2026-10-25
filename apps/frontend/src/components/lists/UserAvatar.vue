<script setup lang="ts">
import { computed } from 'vue';

import { AVATAR_PALETTE, colorFromId } from '@/lib/format';

const props = defineProps<{
  id: string;
  name: string;
  imageUrl?: string | null;
  // Overrides the per-id palette colour.
  color?: string;
}>();

const initial = computed(() => props.name.trim().charAt(0).toUpperCase());
const background = computed(() => props.color ?? colorFromId(props.id, AVATAR_PALETTE));
</script>

<template>
  <span
    class="flex items-center justify-center overflow-hidden rounded-full font-extrabold text-ink"
    :style="{ background }"
  >
    <img
      v-if="imageUrl"
      :src="imageUrl"
      alt=""
      aria-hidden="true"
      class="h-full w-full rounded-full object-cover"
    />
    <span v-else aria-hidden="true">{{ initial }}</span>
  </span>
</template>
