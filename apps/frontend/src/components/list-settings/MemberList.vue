<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import UserAvatar from '@/components/lists/UserAvatar.vue';
import type { PendingInvitation, ShoppingListMember } from '@/types/shoppingList';

const props = defineProps<{
  members: ShoppingListMember[];
  pendingInvitations: PendingInvitation[];
  isCurrentUser: (memberId: string) => boolean;
  removingMemberId: string | null;
  cancellingInvitationId: string | null;
}>();

defineEmits<{
  remove: [member: ShoppingListMember];
  cancel: [invitation: PendingInvitation];
}>();

const { t } = useI18n();

// The last member cannot leave an empty list, and nobody removes themselves here.
const canRemove = (member: ShoppingListMember): boolean =>
  props.members.length > 1 && !props.isCurrentUser(member.id);
</script>

<template>
  <ul
    :aria-label="t('shoppingListSettings.membersHeading')"
    class="m-0 flex list-none flex-col gap-1 overflow-hidden rounded-xl p-0"
  >
    <li
      v-for="member in members"
      :key="member.id"
      data-testid="list-member"
      class="flex min-h-17 items-center gap-3 bg-surface pr-1.5 pl-3.5"
    >
      <UserAvatar
        :id="member.id"
        :name="member.displayName"
        :image-url="member.imageUrl"
        class="h-10 w-10 shrink-0 text-base"
      />
      <div class="flex min-w-0 flex-1 flex-col">
        <span class="truncate text-[17px] font-extrabold">
          {{ isCurrentUser(member.id) ? t('shoppingListSettings.youSuffix', { name: member.displayName }) : member.displayName }}
        </span>
        <span class="truncate text-sm font-semibold text-[#C4CDD4]">{{ member.email }}</span>
      </div>
      <button
        v-if="canRemove(member)"
        type="button"
        :aria-label="t('shoppingListSettings.removeMemberAria', { name: member.displayName })"
        :disabled="removingMemberId === member.id"
        class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#C4CDD4] transition hover:bg-white/10 hover:text-white focus-visible:outline-3 focus-visible:outline-accent disabled:opacity-60"
        @click="$emit('remove', member)"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true">
          <path d="M6 6l12 12 M18 6L6 18" />
        </svg>
      </button>
    </li>

    <!-- Pending invitations: email only, the invitee's name stays hidden (ADR-0011). -->
    <li
      v-for="invitation in pendingInvitations"
      :key="invitation.id"
      data-testid="pending-invitation"
      class="flex min-h-17 items-center gap-3 bg-surface pr-1.5 pl-3.5"
    >
      <span
        aria-hidden="true"
        class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-accent text-base font-extrabold text-accent"
      >?</span>
      <div class="flex min-w-0 flex-1 flex-col">
        <span class="text-[17px] font-extrabold text-accent">{{ t('shoppingListSettings.invitationSent') }}</span>
        <span class="truncate text-sm font-semibold text-[#C4CDD4]">{{ invitation.email }}</span>
      </div>
      <button
        type="button"
        :aria-label="t('shoppingListSettings.cancelInvitationAria', { email: invitation.email })"
        :disabled="cancellingInvitationId === invitation.id"
        class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#C4CDD4] transition hover:bg-white/10 hover:text-white focus-visible:outline-3 focus-visible:outline-accent disabled:opacity-60"
        @click="$emit('cancel', invitation)"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true">
          <path d="M6 6l12 12 M18 6L6 18" />
        </svg>
      </button>
    </li>
  </ul>
</template>
