import axios from 'axios';
import { onMounted, onUnmounted, ref, type Ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { api } from '@/lib/api';
import { currentPageTitle } from '@/router';
import type {
  ShoppingList,
  ShoppingListsResponse,
  InvitationListItem,
} from '@/types/shoppingList';

export type UseShoppingListsViewReturn = {
  shoppingLists: Ref<ShoppingList[]>;
  invitations: Ref<InvitationListItem[]>;
  isLoading: Ref<boolean>;
  errorMessage: Ref<string>;
  acceptingInvitationId: Ref<string | null>;
  decliningInvitationId: Ref<string | null>;
  invitationErrorMessage: Ref<string>;
  failingInvitationId: Ref<string | null>;
  acceptInvitation: (invitation: InvitationListItem) => Promise<void>;
  declineInvitation: (invitation: InvitationListItem) => Promise<void>;
  newShoppingListName: Ref<string>;
  isCreateFormVisible: Ref<boolean>;
  isCreating: Ref<boolean>;
  createErrorMessage: Ref<string>;
  openCreateForm: () => void;
  closeCreateForm: () => void;
  createShoppingList: () => Promise<void>;
};

/**
 * View model for `ShoppingListsView`: the list + invitation list fetch, the
 * invitation accept/decline responses, the inline create-list form, and the
 * `currentPageTitle` mount/unmount coupling every view shares.
 *
 * It is bound to a single view and already depends on the API client and the
 * module-level `currentPageTitle` ref, so it resolves its own strings through
 * `useI18n()` instead of taking injected messages.
 *
 * MUST be called synchronously from `setup()`: it registers `onMounted` /
 * `onUnmounted`.
 */
export const useShoppingListsView = (): UseShoppingListsViewReturn => {
  const { t } = useI18n();

  const shoppingLists = ref<ShoppingList[]>([]);
  const invitations = ref<InvitationListItem[]>([]);
  const isLoading = ref(true);
  const errorMessage = ref('');

  const loadShoppingLists = async () => {
    isLoading.value = true;
    errorMessage.value = '';

    try {
      const { data } = await api.get<ShoppingListsResponse>('/lists');
      shoppingLists.value = data.shoppingLists;
      invitations.value = data.invitations ?? [];
    } catch {
      errorMessage.value = t('shoppingLists.loadFailed');
    } finally {
      isLoading.value = false;
    }
  };

  const acceptingInvitationId = ref<string | null>(null);
  const decliningInvitationId = ref<string | null>(null);
  const invitationErrorMessage = ref('');
  const failingInvitationId = ref<string | null>(null);

  const respondToInvitation = async (
    invitation: InvitationListItem,
    action: 'accept' | 'decline',
    pendingId: Ref<string | null>,
    errorKey: 'shoppingLists.acceptError' | 'shoppingLists.declineError',
  ): Promise<void> => {
    invitationErrorMessage.value = '';
    failingInvitationId.value = null;
    pendingId.value = invitation.id;
    try {
      await api.post(
        `/lists/${invitation.shoppingListId}/invitations/${invitation.id}/${action}`,
      );
      await loadShoppingLists();
    } catch {
      invitationErrorMessage.value = t(errorKey);
      failingInvitationId.value = invitation.id;
    } finally {
      pendingId.value = null;
    }
  };

  const acceptInvitation = (invitation: InvitationListItem): Promise<void> =>
    respondToInvitation(
      invitation,
      'accept',
      acceptingInvitationId,
      'shoppingLists.acceptError',
    );

  const declineInvitation = (invitation: InvitationListItem): Promise<void> =>
    respondToInvitation(
      invitation,
      'decline',
      decliningInvitationId,
      'shoppingLists.declineError',
    );

  const newShoppingListName = ref('');
  const isCreateFormVisible = ref(false);
  const isCreating = ref(false);
  const createErrorMessage = ref('');

  const openCreateForm = () => {
    isCreateFormVisible.value = true;
    createErrorMessage.value = '';
  };

  const closeCreateForm = () => {
    isCreateFormVisible.value = false;
    isCreating.value = false;
    newShoppingListName.value = '';
    createErrorMessage.value = '';
  };

  const createShoppingList = async () => {
    const name = newShoppingListName.value.trim();

    if (!name) {
      createErrorMessage.value = t('shoppingLists.enterShoppingListName');
      return;
    }

    isCreating.value = true;
    createErrorMessage.value = '';

    try {
      await api.post('/lists', { name });
      closeCreateForm();
      await loadShoppingLists();
    } catch (error: unknown) {
      if (
        axios.isAxiosError(error) &&
        typeof error.response?.data?.message === 'string'
      ) {
        createErrorMessage.value = error.response.data.message;
      } else {
        createErrorMessage.value = t('shoppingLists.createFailed');
      }
    } finally {
      isCreating.value = false;
    }
  };

  onMounted(() => {
    currentPageTitle.value = t('shoppingLists.title');
    loadShoppingLists();
  });

  onUnmounted(() => {
    currentPageTitle.value = null;
  });

  return {
    shoppingLists,
    invitations,
    isLoading,
    errorMessage,
    acceptingInvitationId,
    decliningInvitationId,
    invitationErrorMessage,
    failingInvitationId,
    acceptInvitation,
    declineInvitation,
    newShoppingListName,
    isCreateFormVisible,
    isCreating,
    createErrorMessage,
    openCreateForm,
    closeCreateForm,
    createShoppingList,
  };
};
