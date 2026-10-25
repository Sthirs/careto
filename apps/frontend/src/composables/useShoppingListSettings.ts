import axios from 'axios';
import { ref, type Ref } from 'vue';

import {
  useImageUpload,
  type UseImageUploadReturn,
} from '@/composables/useImageUpload';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import type {
  ShoppingListDetail,
  ShoppingListMember,
  PendingInvitation,
} from '@/types/shoppingList';

/**
 * Caller-supplied strings: this module never imports i18n, the caller
 * resolves every message.
 */
export type ShoppingListSettingsMessages = {
  shoppingListNameEmpty: () => string;
  updateNameError: () => string;
  addMemberEmailEmpty: () => string;
  addMemberError: () => string;
  removeMemberError: (name: string) => string;
  cancelInvitationError: (email: string) => string;
  imageInvalidType: () => string;
  imageTooLarge: () => string;
  imageUploadFailed: () => string;
};

export type UseShoppingListSettingsReturn = UseImageUploadReturn & {
  initialsOf: (name: string) => string;
  isCurrentUser: (memberId: string) => boolean;
  shoppingListName: Ref<string>;
  nameError: Ref<string>;
  isSubmittingName: Ref<boolean>;
  memberEmail: Ref<string>;
  memberError: Ref<string>;
  isSubmittingMember: Ref<boolean>;
  removingMemberId: Ref<string | null>;
  cancellingInvitationId: Ref<string | null>;
  saveName: () => Promise<void>;
  addMember: () => Promise<void>;
  removeMember: (member: ShoppingListMember) => Promise<void>;
  cancelInvitation: (invitation: PendingInvitation) => Promise<void>;
};

/** The API answers member-invite failures with a human-readable reason. */
const serverMessage = (error: unknown): string | undefined =>
  axios.isAxiosError<{ message?: string }>(error) &&
  typeof error.response?.data?.message === 'string'
    ? error.response.data.message
    : undefined;

/**
 * Every mutation the list settings panel performs. `list` is a getter so the
 * panel keeps reading through its `list` prop and stays reactive to parent
 * refetches; `onUpdated` is the panel's `updated` emit.
 */
export const useShoppingListSettings = (
  shoppingList: () => ShoppingListDetail,
  onUpdated: () => void,
  messages: ShoppingListSettingsMessages,
): UseShoppingListSettingsReturn => {
  const authStore = useAuthStore();

  const shoppingListName = ref(shoppingList().name);
  const nameError = ref('');
  const isSubmittingName = ref(false);

  const memberEmail = ref('');
  const memberError = ref('');
  const isSubmittingMember = ref(false);

  const removingMemberId = ref<string | null>(null);
  const cancellingInvitationId = ref<string | null>(null);

  const initialsOf = (name: string): string => {
    if (!name || !name.trim()) return '';
    const words = name.trim().split(/\s+/).filter(Boolean);
    return words
      .slice(0, 2)
      .map((w) => w.charAt(0).toUpperCase())
      .join('');
  };

  const isCurrentUser = (memberId: string): boolean =>
    authStore.user?.id === memberId;

  const saveName = async (): Promise<void> => {
    if (!shoppingListName.value.trim()) {
      nameError.value = messages.shoppingListNameEmpty();
      return;
    }

    isSubmittingName.value = true;
    nameError.value = '';

    try {
      await api.patch(`/lists/${shoppingList().id}`, {
        name: shoppingListName.value.trim(),
      });
      onUpdated();
    } catch {
      nameError.value = messages.updateNameError();
    } finally {
      isSubmittingName.value = false;
    }
  };

  const addMember = async (): Promise<void> => {
    if (!memberEmail.value.trim()) {
      memberError.value = messages.addMemberEmailEmpty();
      return;
    }

    isSubmittingMember.value = true;
    memberError.value = '';

    try {
      await api.post(`/lists/${shoppingList().id}/members`, {
        email: memberEmail.value.trim().toLowerCase(),
      });
      memberEmail.value = '';
      onUpdated();
    } catch (error: unknown) {
      memberError.value = serverMessage(error) || messages.addMemberError();
    } finally {
      isSubmittingMember.value = false;
    }
  };

  const removeMember = async (member: ShoppingListMember): Promise<void> => {
    removingMemberId.value = member.id;

    try {
      await api.delete(`/lists/${shoppingList().id}/members/${member.id}`);
      onUpdated();
    } catch {
      memberError.value = messages.removeMemberError(member.displayName);
    } finally {
      removingMemberId.value = null;
    }
  };

  const cancelInvitation = async (
    invitation: PendingInvitation,
  ): Promise<void> => {
    cancellingInvitationId.value = invitation.id;

    try {
      await api.delete(`/lists/${shoppingList().id}/invitations/${invitation.id}`);
      onUpdated();
    } catch {
      memberError.value = messages.cancelInvitationError(invitation.email);
    } finally {
      cancellingInvitationId.value = null;
    }
  };

  const imageUpload = useImageUpload(
    async (file) => {
      const formData = new FormData();
      formData.append('image', file);
      await api.post(`/lists/${shoppingList().id}/image`, formData);
      onUpdated();
    },
    {
      invalidType: messages.imageInvalidType,
      tooLarge: messages.imageTooLarge,
      uploadFailed: messages.imageUploadFailed,
    },
  );

  return {
    ...imageUpload,
    initialsOf,
    isCurrentUser,
    shoppingListName,
    nameError,
    isSubmittingName,
    memberEmail,
    memberError,
    isSubmittingMember,
    removingMemberId,
    cancellingInvitationId,
    saveName,
    addMember,
    removeMember,
    cancelInvitation,
  };
};
