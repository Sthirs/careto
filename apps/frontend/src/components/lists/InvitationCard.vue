<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { COVER_PALETTE, colorFromId, shoppingListInitials } from '@/lib/format';
import type { InvitationListItem } from '@/types/shoppingList';

const props = defineProps<{
  invitation: InvitationListItem;
  busy: boolean;
  errorMessage: string;
}>();

const emit = defineEmits<{ accept: []; decline: [] }>();

const { t } = useI18n();

const coverColor = computed(() => colorFromId(props.invitation.shoppingListId, COVER_PALETTE));
</script>

<template>
  <article class="flex flex-col gap-3.5 rounded-[14px] border-2 border-dashed border-accent bg-surface p-4">
    <div class="flex items-center gap-3.5">
      <div
        role="img"
        :aria-label="t('shoppingLists.thumbnailAria', { name: invitation.shoppingListName })"
        class="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-lg font-black text-white/80"
        :style="{ background: coverColor }"
      >
        {{ shoppingListInitials(invitation.shoppingListName) }}
      </div>
      <div class="min-w-0 flex-1">
        <h3 class="truncate text-[19px] font-extrabold">{{ invitation.shoppingListName }}</h3>
        <p class="mt-0.5 truncate text-[15px] font-semibold text-text-secondary">
          {{ t('shoppingLists.invitedBy', { name: invitation.inviterName }) }}
        </p>
      </div>
    </div>

    <p v-if="errorMessage" role="alert" class="rounded-lg bg-danger/15 px-3 py-1.5 text-sm font-semibold text-white">
      {{ errorMessage }}
    </p>

    <div class="flex gap-2.5">
      <button
        type="button"
        class="h-11.5 flex-1 rounded-full border-2 border-outline text-base font-extrabold text-white transition hover:bg-white/5 focus-visible:outline-3 focus-visible:outline-accent disabled:opacity-60"
        :disabled="busy"
        @click="emit('decline')"
      >
        {{ t('shoppingLists.decline') }}
      </button>
      <button
        type="button"
        class="h-11.5 flex-1 rounded-full bg-brand-500 text-base font-extrabold text-white transition hover:bg-brand-600 focus-visible:outline-3 focus-visible:outline-accent disabled:opacity-60"
        :disabled="busy"
        @click="emit('accept')"
      >
        {{ t('shoppingLists.accept') }}
      </button>
    </div>
  </article>
</template>
