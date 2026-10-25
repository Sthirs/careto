<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import UserAvatar from '@/components/lists/UserAvatar.vue';

defineProps<{
  userId: string;
  name: string;
  imageUrl?: string | null;
  isUploading: boolean;
}>();

defineEmits<{ change: [event: Event] }>();

const { t } = useI18n();
</script>

<template>
  <div class="relative mb-1 self-center" data-testid="account-avatar-wrapper">
    <UserAvatar
      :id="userId"
      data-testid="account-avatar"
      role="img"
      :aria-label="t('account.profilePhotoAria')"
      :name="name || 'U'"
      :image-url="imageUrl"
      color="#8ED9C9"
      class="h-30 w-30 text-5xl"
    />

    <label
      for="avatar-upload"
      data-testid="account-avatar-edit"
      :aria-label="t('account.changePhoto')"
      class="absolute -right-1 -bottom-1 flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border-4 border-brand-900 bg-brand-500 text-white transition hover:bg-brand-600"
      :class="{ 'pointer-events-none opacity-60': isUploading }"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M4 8h3l2-3h6l2 3h3v11H4z M12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" />
      </svg>
    </label>

    <input
      id="avatar-upload"
      data-testid="account-avatar-input"
      type="file"
      accept="image/*"
      class="pointer-events-none absolute inset-0 opacity-0"
      aria-hidden="true"
      :disabled="isUploading"
      @change="$emit('change', $event)"
    />
  </div>
</template>
