<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { RouterLink } from 'vue-router';

import UserAvatar from '@/components/lists/UserAvatar.vue';
import { useAuthStore } from '@/stores/auth';

const { t } = useI18n();
const authStore = useAuthStore();
</script>

<template>
  <RouterLink
    :to="{ name: 'account' }"
    :aria-label="t('app.openAccountPageAria')"
    class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#243039] focus-visible:outline-3 focus-visible:outline-accent"
  >
    <UserAvatar
      :id="authStore.user?.id ?? ''"
      :name="authStore.user?.displayName ?? 'U'"
      :image-url="authStore.user?.imageUrl"
      color="#8ED9C9"
      class="h-9 w-9 text-base"
    />
  </RouterLink>
</template>
