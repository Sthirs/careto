<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const query = defineModel<string>({ required: true });

const { t } = useI18n();
</script>

<template>
  <div class="flex h-13 items-center gap-2.5 rounded-xl bg-white pr-1.5 pl-3.5 focus-within:outline-3 focus-within:outline-offset-1 focus-within:outline-accent">
    <label for="item-search" class="sr-only">{{ t('shoppingListDetail.searchLabel') }}</label>
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5B6670" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
      <path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z M20 20l-4-4" />
    </svg>
    <input
      id="item-search"
      v-model="query"
      type="text"
      autocomplete="off"
      enterkeyhint="done"
      :placeholder="t('shoppingListDetail.searchPlaceholder')"
      class="min-w-0 flex-1 bg-transparent text-[17px] text-ink outline-none placeholder:text-[#6B7680]"
      @keydown.esc="query = ''"
    />
    <button
      v-if="query"
      type="button"
      class="flex size-10 items-center justify-center rounded-full bg-[#E8EEF2] text-[#2E3A44] focus-visible:outline-3 focus-visible:outline-accent"
      :aria-label="t('shoppingListDetail.clearSearch')"
      @click="query = ''"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true">
        <path d="M6 6l12 12 M18 6L6 18" />
      </svg>
    </button>
  </div>
</template>
