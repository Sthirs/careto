<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import AccountAvatarPicker from '@/components/account/AccountAvatarPicker.vue';
import LanguageListbox from '@/components/account/LanguageListbox.vue';
import ScreenHeader from '@/components/ScreenHeader.vue';
import { useAccountProfile } from '@/composables/useAccountProfile';
import { useImageUpload } from '@/composables/useImageUpload';
import { goBackOr } from '@/lib/backNavigation';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const authStore = useAuthStore();
const { t } = useI18n();

const appVersion: string = import.meta.env.VITE_APP_VERSION ?? 'dev';

const { name, email, selectedLanguage, canSave, isSaving, errorMessage, save } =
  useAccountProfile({ saveError: () => t('account.saveError') });

const { isUploading, uploadError, handleFileChange } = useImageUpload(
  (file) => authStore.uploadImage(file),
  {
    invalidType: () => t('account.changePhotoErrorInvalid'),
    tooLarge: () => t('account.changePhotoErrorTooLarge'),
    uploadFailed: () => t('account.changePhotoErrorGeneric'),
  },
);

const goBack = () => {
  goBackOr(router, { name: 'shoppingLists' });
};

const logout = async () => {
  // Awaited so the ADR-0018 refresh-token family is revoked server-side before
  // we navigate away.
  await authStore.logout();
  await router.push('/login');
};
</script>

<template>
  <div class="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col">
    <ScreenHeader :title="t('account.title')" :back-label="t('common.back')" @back="goBack" />

    <main class="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 pt-4 pb-6">
      <AccountAvatarPicker
        :user-id="authStore.user?.id ?? ''"
        :name="name.trim()"
        :image-url="authStore.user?.imageUrl"
        :is-uploading="isUploading"
        @change="handleFileChange"
      />

      <p v-if="uploadError" data-testid="account-upload-error" role="alert" class="text-center text-sm font-semibold text-[#FFB4AB]">
        {{ uploadError }}
      </p>
      <p v-if="isUploading" data-testid="account-uploading" class="text-center text-sm font-semibold text-accent">
        {{ t('account.photoUploading') }}
      </p>

      <div class="flex flex-col gap-1.5">
        <label for="account-name" class="pl-1 text-sm font-extrabold text-text-secondary">
          {{ t('account.fullName') }}
        </label>
        <input
          id="account-name"
          v-model="name"
          type="text"
          maxlength="100"
          autocomplete="name"
          :placeholder="t('account.fullNamePlaceholder')"
          class="h-13 rounded-xl bg-white px-4 text-[17px] text-ink outline-none placeholder:text-[#6B7680] focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-accent"
        />
      </div>

      <div class="flex flex-col gap-1.5">
        <label for="account-email" class="pl-1 text-sm font-extrabold text-text-secondary">
          {{ t('account.email') }}
        </label>
        <div class="flex h-13 items-center gap-2.5 rounded-xl border border-surface bg-[#243039] px-4">
          <input
            id="account-email"
            :value="email"
            type="email"
            readonly
            aria-describedby="account-email-help"
            class="min-w-0 flex-1 bg-transparent text-[17px] text-[#C4CDD4] outline-none"
          />
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#B4BEC6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M6 11h12v9H6z M8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
        </div>
        <p id="account-email-help" class="pl-1 text-[13px] font-semibold text-text-muted">
          {{ t('account.emailManaged') }}
        </p>
      </div>

      <div class="flex flex-col gap-1.5">
        <span id="account-language-label" class="pl-1 text-sm font-extrabold text-text-secondary">
          {{ t('common.language') }}
        </span>
        <LanguageListbox v-model="selectedLanguage" label-id="account-language-label" />
      </div>

      <div class="flex-1"></div>

      <div class="flex flex-col gap-3">
        <p v-if="errorMessage" data-testid="account-error" role="alert" class="text-sm font-semibold text-[#FFB4AB]">
          {{ errorMessage }}
        </p>
        <button
          type="button"
          data-testid="account-save"
          :disabled="!canSave"
          class="h-13.5 rounded-full bg-brand-500 text-lg font-extrabold text-white transition enabled:hover:bg-brand-600 focus-visible:outline-3 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
          @click="save"
        >
          {{ isSaving ? t('common.saving') : t('account.saveChanges') }}
        </button>
        <button
          type="button"
          class="flex h-13.5 items-center justify-center gap-2.5 rounded-full border-2 border-danger text-lg font-extrabold text-[#FFB4B0] transition hover:bg-danger/10 focus-visible:outline-3 focus-visible:outline-accent"
          @click="logout"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M10 4H5v16h5 M15 8l4 4-4 4 M19 12H9" />
          </svg>
          {{ t('account.logOut') }}
        </button>
        <p data-testid="account-version" class="mt-2 text-center text-[13px] font-semibold text-text-muted">
          {{ t('account.versionLine', { version: appVersion }) }}
        </p>
      </div>
    </main>
  </div>
</template>
