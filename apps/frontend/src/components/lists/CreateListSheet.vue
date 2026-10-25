<script setup lang="ts">
import { useI18n } from 'vue-i18n';

defineProps<{
  isOpen: boolean;
  isCreating: boolean;
  errorMessage: string;
}>();

const name = defineModel<string>('name', { required: true });

const emit = defineEmits<{ open: []; close: []; submit: [] }>();

const { t } = useI18n();
</script>

<template>
  <div
    class="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-3 rounded-t-[22px] bg-sheet px-4 pt-2.5 pb-6 shadow-[0_-8px_24px_rgba(0,0,0,0.35)]"
  >
    <span aria-hidden="true" class="h-[5px] w-12 self-center rounded-full bg-divider"></span>

    <form v-if="isOpen" class="flex flex-col gap-3" @submit.prevent="emit('submit')">
      <div class="flex flex-col gap-1.5">
        <label for="new-list-name" class="pl-1 text-sm font-extrabold text-text-secondary">
          {{ t('shoppingLists.createShoppingListLabel') }}
        </label>
        <input
          id="new-list-name"
          v-model="name"
          type="text"
          name="shoppingListName"
          autocomplete="off"
          :placeholder="t('shoppingLists.createShoppingListPlaceholder')"
          class="h-13 w-full rounded-xl bg-white px-4 text-[17px] text-ink outline-none placeholder:text-[#6B7680] focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-accent"
        />
      </div>
      <p v-if="errorMessage" role="alert" class="rounded-xl bg-danger/15 px-4 py-3 text-sm font-semibold text-white">
        {{ errorMessage }}
      </p>
      <div class="flex gap-2.5">
        <button
          type="button"
          class="h-13.5 flex-1 rounded-full border-2 border-outline text-lg font-extrabold text-white transition hover:bg-white/5 focus-visible:outline-3 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="isCreating"
          @click="emit('close')"
        >
          {{ t('common.cancel') }}
        </button>
        <button
          type="submit"
          class="h-13.5 flex-1 rounded-full bg-brand-500 text-lg font-extrabold text-white transition hover:bg-brand-600 focus-visible:outline-3 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="isCreating"
        >
          {{ isCreating ? t('shoppingLists.creating') : t('shoppingLists.create') }}
        </button>
      </div>
    </form>

    <button
      v-else
      type="button"
      class="flex h-13.5 items-center justify-center gap-2.5 rounded-full bg-brand-500 text-lg font-extrabold text-white transition hover:bg-brand-600 focus-visible:outline-3 focus-visible:outline-accent active:scale-[0.98]"
      @click="emit('open')"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" aria-hidden="true">
        <path d="M12 5v14 M5 12h14" />
      </svg>
      {{ t('shoppingLists.createShoppingList') }}
    </button>
  </div>
</template>
