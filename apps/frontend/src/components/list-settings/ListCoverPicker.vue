<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { COVER_PALETTE, colorFromId, shoppingListInitials } from '@/lib/format';
import type { ShoppingListDetail } from '@/types/shoppingList';

const props = defineProps<{
  shoppingList: ShoppingListDetail;
  isUploading: boolean;
  uploadError: string;
}>();

defineEmits<{ change: [event: Event] }>();

const { t } = useI18n();

// Same placeholder cover as the list's card on "My lists".
const coverColor = computed(() => colorFromId(props.shoppingList.id, COVER_PALETTE));
</script>

<template>
  <div class="flex flex-col gap-2" data-testid="list-image-picker">
    <div class="relative h-30 overflow-hidden rounded-2xl">
      <img
        v-if="shoppingList.imageUrl"
        :src="shoppingList.imageUrl"
        :alt="t('shoppingLists.shoppingListImageAria', { name: shoppingList.name })"
        class="h-full w-full object-cover"
        data-testid="list-image-preview"
      />
      <div
        v-else
        role="img"
        :aria-label="t('shoppingLists.thumbnailAria', { name: shoppingList.name })"
        class="flex h-full items-center justify-center text-5xl font-black text-white/55"
        :style="{ background: coverColor }"
      >
        {{ shoppingListInitials(shoppingList.name) }}
      </div>

      <label
        for="list-image-upload"
        data-testid="list-image-edit"
        class="absolute right-3 bottom-3 flex h-11 cursor-pointer items-center gap-2 rounded-full bg-[rgba(20,26,31,0.75)] pr-4 pl-3 text-[15px] font-extrabold text-white transition hover:bg-[rgba(20,26,31,0.9)]"
        :class="{ 'pointer-events-none opacity-60': isUploading }"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M4 8h3l2-3h6l2 3h3v11H4z M12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" />
        </svg>
        {{ t('shoppingListSettings.changeImage') }}
      </label>

      <div v-if="isUploading" class="absolute inset-0 flex items-center justify-center bg-black/50">
        <p class="text-sm font-semibold text-text-secondary">{{ t('shoppingListSettings.imageUploading') }}</p>
      </div>

      <input
        id="list-image-upload"
        data-testid="list-image-input"
        type="file"
        accept="image/*"
        class="pointer-events-none absolute inset-0 opacity-0"
        aria-hidden="true"
        :disabled="isUploading"
        @change="$emit('change', $event)"
      />
    </div>

    <p v-if="uploadError" data-testid="image-upload-error" role="alert" class="text-center text-sm font-semibold text-[#FFB4AB]">
      {{ uploadError }}
    </p>
  </div>
</template>
