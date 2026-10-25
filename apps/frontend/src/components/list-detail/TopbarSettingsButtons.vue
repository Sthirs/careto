<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import type { ShoppingListDetail } from '@/types/shoppingList';

defineProps<{ shoppingList: ShoppingListDetail | null; shoppingListId: string }>();

const { t } = useI18n();
const router = useRouter();
</script>

<template>
  <Teleport to="#topbar-actions">
    <button
      v-if="shoppingList"
      type="button"
      class="hidden rounded-md border border-white/10 px-3 py-1.5 text-sm font-medium text-[#FFFFFF] transition hover:border-white/20 hover:bg-white/5 sm:inline-flex"
      @click="
        router.push({
          name: 'list-settings',
          params: { id: shoppingListId },
          state: { shoppingListName: shoppingList.name },
        })
      "
    >
      {{ t('shoppingListDetail.settings') }}
    </button>
    <button
      v-if="shoppingList"
      type="button"
      class="flex h-9 w-9 items-center justify-center rounded-full text-[#D3DAE0] transition hover:bg-white/10 hover:text-[#FFFFFF] sm:hidden"
      :aria-label="t('shoppingListDetail.toggleSettings')"
      @click="
        router.push({
          name: 'list-settings',
          params: { id: shoppingListId },
          state: { shoppingListName: shoppingList.name },
        })
      "
    >
      <svg viewBox="0 0 20 20" class="h-5 w-5 fill-current">
        <path
          fill-rule="evenodd"
          d="M7.84 1.804A1 1 0 0 1 8.82 1h2.36a1 1 0 0 1 .98.804l.331 1.652a6.993 6.993 0 0 1 1.929 1.115l1.598-.54a1 1 0 0 1 1.186.447l1.18 2.044a1 1 0 0 1-.205 1.251l-1.267 1.113a7.047 7.047 0 0 1 0 2.228l1.267 1.113a1 1 0 0 1 .206 1.25l-1.18 2.045a1 1 0 0 1-1.187.447l-1.598-.54a6.993 6.993 0 0 1-1.929 1.115l-.33 1.652a1 1 0 0 1-.98.804H8.82a1 1 0 0 1-.98-.804l-.331-1.652a6.993 6.993 0 0 1-1.929-1.115l-1.598.54a1 1 0 0 1-1.186-.447l-1.18-2.044a1 1 0 0 1 .205-1.251l1.267-1.114a7.05 7.05 0 0 1 0-2.227L1.821 7.773a1 1 0 0 1-.206-1.25l1.18-2.045a1 1 0 0 1 1.187-.447l1.598.54A6.992 6.992 0 0 1 7.51 3.456l.33-1.652ZM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
          clip-rule="evenodd"
        />
      </svg>
    </button>
  </Teleport>
</template>
