<script setup lang="ts">
defineProps<{ title: string; backLabel: string }>();

defineEmits<{ back: [] }>();
</script>

<template>
  <header class="flex shrink-0 items-center gap-3.5 px-4 pt-4 pb-2">
    <button
      type="button"
      :aria-label="backLabel"
      class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#243039] text-white transition hover:brightness-125 focus-visible:outline-3 focus-visible:outline-accent"
      @click="$emit('back')"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M15 5l-7 7 7 7" />
      </svg>
    </button>
    <h1 class="min-w-0 flex-1 truncate text-4xl font-extrabold tracking-[-0.01em]">{{ title }}</h1>
    <slot name="trailing" />
  </header>
</template>
