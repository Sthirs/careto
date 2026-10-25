<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import ListSectionsDock from '@/components/list-sections/ListSectionsDock.vue';
import ListCoverPicker from '@/components/list-settings/ListCoverPicker.vue';
import MemberInviteForm from '@/components/list-settings/MemberInviteForm.vue';
import MemberList from '@/components/list-settings/MemberList.vue';
import { useShoppingListSettings } from '@/composables/useShoppingListSettings';
import type { ShoppingListDetail } from '@/types/shoppingList';

const props = defineProps<{
  shoppingList: ShoppingListDetail;
}>();

const emit = defineEmits<{
  updated: [];
}>();

const { t } = useI18n();

const {
  isCurrentUser,
  shoppingListName,
  nameError,
  isSubmittingName,
  memberEmail,
  memberError,
  isSubmittingMember,
  removingMemberId,
  cancellingInvitationId,
  isUploading,
  uploadError,
  handleFileChange,
  saveName,
  addMember,
  removeMember,
  cancelInvitation,
} = useShoppingListSettings(
  () => props.shoppingList,
  () => emit('updated'),
  {
    shoppingListNameEmpty: () => t('shoppingListSettings.shoppingListNameEmpty'),
    updateNameError: () => t('shoppingListSettings.updateNameError'),
    addMemberEmailEmpty: () => t('shoppingListSettings.addMemberEmailEmpty'),
    addMemberError: () => t('shoppingListSettings.addMemberError'),
    removeMemberError: (name) => t('shoppingListSettings.removeMemberError', { name }),
    cancelInvitationError: (email) =>
      t('shoppingListSettings.cancelInvitationError', { email }),
    imageInvalidType: () => t('shoppingListSettings.changeImageErrorInvalid'),
    imageTooLarge: () => t('shoppingListSettings.changeImageErrorTooLarge'),
    imageUploadFailed: () => t('shoppingListSettings.changeImageErrorGeneric'),
  },
);
</script>

<template>
  <div class="flex flex-col gap-5.5">
    <ListCoverPicker
      :shopping-list="props.shoppingList"
      :is-uploading="isUploading"
      :upload-error="uploadError"
      @change="handleFileChange"
    />

    <form class="flex flex-col gap-1.5" @submit.prevent="saveName">
      <label for="list-name" class="pl-1 text-sm font-extrabold text-text-secondary">
        {{ t('shoppingListSettings.shoppingListNameLabel') }}
      </label>
      <input
        id="list-name"
        v-model="shoppingListName"
        type="text"
        autocomplete="off"
        data-testid="list-name-input"
        class="h-13 rounded-xl bg-white px-4 text-[17px] text-ink outline-none focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-accent"
      />
      <p v-if="nameError" role="alert" class="pl-1 text-sm font-semibold text-[#FFB4AB]">{{ nameError }}</p>
    </form>

    <section class="flex flex-col gap-3">
      <h2 class="text-[22px] font-extrabold">{{ t('shoppingListSettings.membersHeading') }}</h2>
      <MemberInviteForm
        v-model:email="memberEmail"
        :is-submitting="isSubmittingMember"
        :error-message="memberError"
        @submit="addMember"
      />
      <MemberList
        :members="props.shoppingList.members"
        :pending-invitations="props.shoppingList.pendingInvitations ?? []"
        :is-current-user="isCurrentUser"
        :removing-member-id="removingMemberId"
        :cancelling-invitation-id="cancellingInvitationId"
        @remove="removeMember"
        @cancel="cancelInvitation"
      />
    </section>

    <ListSectionsDock
      :shopping-list-id="props.shoppingList.id"
      :shopping-list-name="props.shoppingList.name"
      current="list-settings"
    >
      <button
        type="button"
        class="h-13.5 rounded-full bg-brand-500 text-lg font-extrabold text-white transition enabled:hover:bg-brand-600 focus-visible:outline-3 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="isSubmittingName || shoppingListName.trim() === props.shoppingList.name"
        @click="saveName"
      >
        {{ t('shoppingListSettings.save') }}
      </button>
    </ListSectionsDock>
  </div>
</template>
