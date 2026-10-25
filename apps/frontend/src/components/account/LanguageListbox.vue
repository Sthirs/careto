<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';

import type { Locale } from '@/i18n';

defineProps<{ labelId: string }>();

const language = defineModel<Locale>({ required: true });

// Endonyms are intentionally NOT translated — a user must be able to read
// them before switching.
const LANGUAGES: ReadonlyArray<{ id: Locale; code: string; name: string }> = [
  { id: 'en', code: 'EN', name: 'English' },
  { id: 'it', code: 'IT', name: 'Italiano' },
];

const isOpen = ref(false);
const root = ref<HTMLElement | null>(null);
const trigger = ref<HTMLButtonElement | null>(null);
const options = ref<HTMLElement[]>([]);

const current = computed(() => LANGUAGES.find((l) => l.id === language.value) ?? LANGUAGES[0]);

const focusOption = (index: number) => {
  const count = LANGUAGES.length;
  options.value[(index + count) % count]?.focus();
};

const open = async () => {
  isOpen.value = true;
  await nextTick();
  focusOption(LANGUAGES.findIndex((l) => l.id === language.value));
};

const close = (refocus = true) => {
  isOpen.value = false;
  if (refocus) trigger.value?.focus();
};

const pick = (id: Locale) => {
  language.value = id;
  close();
};

const onOptionKeydown = (event: KeyboardEvent, index: number) => {
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      focusOption(index + 1);
      break;
    case 'ArrowUp':
      event.preventDefault();
      focusOption(index - 1);
      break;
    case 'Enter':
    case ' ':
      event.preventDefault();
      pick(LANGUAGES[index].id);
      break;
    case 'Escape':
      event.preventDefault();
      close();
      break;
    case 'Tab':
      close(false);
      break;
  }
};

const onTriggerKeydown = (event: KeyboardEvent) => {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    void open();
  }
};

const onDocumentPointerDown = (event: PointerEvent) => {
  if (root.value && !root.value.contains(event.target as Node)) close(false);
};

watch(isOpen, (value) => {
  if (value) document.addEventListener('pointerdown', onDocumentPointerDown);
  else document.removeEventListener('pointerdown', onDocumentPointerDown);
});

onBeforeUnmount(() => document.removeEventListener('pointerdown', onDocumentPointerDown));
</script>

<template>
  <div ref="root" class="relative">
    <button
      ref="trigger"
      type="button"
      data-testid="account-language"
      aria-haspopup="listbox"
      :aria-expanded="isOpen"
      :aria-labelledby="`${labelId} account-language-value`"
      class="flex h-13 w-full items-center gap-3 bg-white px-4 text-left text-[17px] text-ink focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-accent"
      :class="isOpen ? 'rounded-t-xl' : 'rounded-xl'"
      @click="isOpen ? close() : open()"
      @keydown="onTriggerKeydown"
    >
      <span aria-hidden="true" class="flex h-5.5 w-7.5 items-center justify-center rounded-md bg-[#E8EEF2] text-xs font-extrabold text-[#2E3A44]">
        {{ current.code }}
      </span>
      <span id="account-language-value" class="flex-1 font-bold">{{ current.name }}</span>
      <svg
        width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5B6670" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
        class="transition-transform duration-150"
        :class="{ 'rotate-180': isOpen }"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>

    <ul
      v-if="isOpen"
      role="listbox"
      :aria-labelledby="labelId"
      class="absolute inset-x-0 top-13 z-20 m-0 flex list-none flex-col gap-1 rounded-b-xl border-t border-[#E3E8EC] bg-white p-1.5 shadow-[0_12px_24px_rgba(0,0,0,0.35)]"
    >
      <li
        v-for="(lang, index) in LANGUAGES"
        :key="lang.id"
        ref="options"
        role="option"
        tabindex="-1"
        :aria-selected="lang.id === language"
        class="flex h-12 cursor-pointer items-center gap-3 rounded-[10px] px-3 text-[17px] text-ink outline-none focus-visible:ring-3 focus-visible:ring-accent"
        :class="lang.id === language ? 'bg-[#DDF1EC] font-extrabold' : 'font-semibold hover:bg-[#F1F4F6]'"
        @click="pick(lang.id)"
        @keydown="onOptionKeydown($event, index)"
      >
        <span
          aria-hidden="true"
          class="flex h-5.5 w-7.5 items-center justify-center rounded-md text-xs font-extrabold"
          :class="lang.id === language ? 'bg-brand-500 text-white' : 'bg-[#E8EEF2] text-[#2E3A44]'"
        >
          {{ lang.code }}
        </span>
        <span class="flex-1">{{ lang.name }}</span>
        <svg
          v-if="lang.id === language"
          width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2F7466" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
        >
          <path d="M5 12l5 5 9-10" />
        </svg>
      </li>
    </ul>
  </div>
</template>
