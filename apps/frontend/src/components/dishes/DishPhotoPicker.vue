<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import DishArt from '@/components/dishes/DishArt.vue';

const props = defineProps<{
  /** The dish id, or a stable placeholder for a new dish, to pick the default art. */
  artId: string;
  dishName: string;
  imageUrl: string | null;
  pausedLabel?: string;
  isUploading: boolean;
  uploadError: string;
}>();

defineEmits<{ change: [event: Event] }>();

const { t } = useI18n();

const photoLabel = () =>
  props.imageUrl ? t('dishes.photoAria', { name: props.dishName || t('dishes.newTitle') }) : t('dishes.noPhotoAria');
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="relative h-[220px] shrink-0 overflow-hidden rounded-2xl">
      <div class="absolute inset-0" role="img" :aria-label="photoLabel()" data-testid="dish-photo">
        <DishArt :dish-id="artId" :image-url="imageUrl" :icon-size="88" />
      </div>

      <span
        v-if="pausedLabel"
        class="absolute top-3 left-3 flex h-[30px] items-center gap-1.5 rounded-full bg-[rgba(20,26,31,0.8)] px-3 text-sm font-extrabold"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5h3.5v14H7z M13.5 5H17v14h-3.5z" /></svg>
        {{ pausedLabel }}
      </span>

      <label
        class="absolute right-3 bottom-3 flex h-11 cursor-pointer items-center gap-2 rounded-full bg-[rgba(20,26,31,0.75)] pr-4 pl-3 text-[15px] font-extrabold text-white focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-accent"
        :class="{ 'pointer-events-none opacity-60': isUploading }"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M4 8h3l2-3h6l2 3h3v11H4z M12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" />
        </svg>
        {{ isUploading ? t('dishes.photoUploading') : imageUrl ? t('dishes.changePhoto') : t('dishes.addPhoto') }}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          class="absolute size-px opacity-0"
          data-testid="dish-photo-input"
          :disabled="isUploading"
          @change="$emit('change', $event)"
        />
      </label>
    </div>
    <p v-if="uploadError" role="alert" class="text-center text-sm font-semibold text-[#FFB4AB]">{{ uploadError }}</p>
  </div>
</template>
