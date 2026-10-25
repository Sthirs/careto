<script setup lang="ts">
withDefaults(defineProps<{ path: string; size?: number; strokeWidth?: number }>(), {
  size: 40,
  strokeWidth: 1.4,
});
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="strokeWidth"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    class="shrink-0"
  >
    <path :d="path" />
  </svg>
</template>
