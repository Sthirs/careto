<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink } from 'vue-router';

import UserAvatar from '@/components/lists/UserAvatar.vue';
import { COVER_PALETTE, colorFromId, shoppingListInitials } from '@/lib/format';
import type { ShoppingList } from '@/types/shoppingList';

const MAX_AVATARS = 3;

const props = defineProps<{ shoppingList: ShoppingList }>();

const { t } = useI18n();

const coverColor = computed(() => colorFromId(props.shoppingList.id, COVER_PALETTE));
const visibleMembers = computed(() => props.shoppingList.members.slice(0, MAX_AVATARS));
const hiddenMemberCount = computed(() => props.shoppingList.members.length - MAX_AVATARS);
</script>

<template>
  <RouterLink
    :to="{
      name: 'list-detail',
      params: { id: shoppingList.id },
      state: { shoppingListName: shoppingList.name },
    }"
    class="block overflow-hidden rounded-2xl bg-surface text-white no-underline transition hover:brightness-110 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent"
  >
    <img
      v-if="shoppingList.imageUrl"
      :src="shoppingList.imageUrl"
      :alt="t('shoppingLists.shoppingListImageAria', { name: shoppingList.name })"
      class="h-30 w-full object-cover"
    />
    <div
      v-else
      role="img"
      :aria-label="t('shoppingLists.thumbnailAria', { name: shoppingList.name })"
      class="flex h-30 items-center justify-center text-5xl font-black text-white/55"
      :style="{ background: coverColor }"
    >
      {{ shoppingListInitials(shoppingList.name) }}
    </div>

    <div class="flex items-center gap-3 px-4 py-3.5">
      <h2 class="min-w-0 flex-1 truncate text-xl leading-tight font-extrabold">
        {{ shoppingList.name }}
      </h2>
      <div class="flex shrink-0 -space-x-2">
        <UserAvatar
          v-for="(member, i) in visibleMembers"
          :id="member.id"
          :key="member.id"
          data-testid="member-avatar"
          :name="member.displayName"
          :image-url="member.imageUrl"
          :aria-label="member.displayName"
          class="h-7 w-7 border-2 border-surface text-xs"
          :style="{ zIndex: MAX_AVATARS - i }"
        />
        <span
          v-if="hiddenMemberCount > 0"
          class="flex h-7 w-7 items-center justify-center rounded-full border-2 border-surface bg-outline text-xs font-extrabold text-white"
        >
          +{{ hiddenMemberCount }}
        </span>
      </div>
    </div>
  </RouterLink>
</template>
