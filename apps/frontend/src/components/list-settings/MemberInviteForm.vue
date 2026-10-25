<script setup lang="ts">
import { useI18n } from 'vue-i18n';

defineProps<{ isSubmitting: boolean; errorMessage: string }>();

const email = defineModel<string>('email', { required: true });

defineEmits<{ submit: [] }>();

const { t } = useI18n();
</script>

<template>
  <form class="flex flex-col gap-1.5" @submit.prevent="$emit('submit')">
    <label for="list-member-email" class="pl-1 text-sm font-extrabold text-text-secondary">
      {{ t('shoppingListSettings.addMemberLabel') }}
    </label>
    <div class="flex gap-2.5">
      <input
        id="list-member-email"
        v-model="email"
        type="email"
        autocomplete="off"
        :placeholder="t('shoppingListSettings.emailPlaceholder')"
        class="h-13 min-w-0 flex-1 rounded-xl bg-white px-4 text-[17px] text-ink outline-none placeholder:text-[#6B7680] focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-accent"
      />
      <button
        type="submit"
        class="h-13 shrink-0 rounded-full bg-brand-500 px-5 text-[17px] font-extrabold text-white transition hover:bg-brand-600 focus-visible:outline-3 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="isSubmitting"
      >
        {{ t('shoppingListSettings.add') }}
      </button>
    </div>
    <p v-if="errorMessage" role="alert" class="pl-1 text-sm font-semibold text-[#FFB4AB]">{{ errorMessage }}</p>
  </form>
</template>
