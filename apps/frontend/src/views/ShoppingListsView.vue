<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { RouterLink } from 'vue-router';

import CreateListSheet from '@/components/lists/CreateListSheet.vue';
import InvitationCard from '@/components/lists/InvitationCard.vue';
import ShoppingListCard from '@/components/lists/ShoppingListCard.vue';
import UserAvatar from '@/components/lists/UserAvatar.vue';
import { useShoppingListsView } from '@/composables/useShoppingListsView';
import { useAuthStore } from '@/stores/auth';

const { t } = useI18n();
const authStore = useAuthStore();

const {
  shoppingLists, invitations, isLoading, errorMessage,
  acceptingInvitationId, decliningInvitationId, invitationErrorMessage,
  failingInvitationId, acceptInvitation, declineInvitation,
  newShoppingListName, isCreateFormVisible, isCreating, createErrorMessage,
  openCreateForm, closeCreateForm, createShoppingList,
} = useShoppingListsView();
</script>

<template>
  <div class="relative mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col overflow-hidden">
    <header class="flex shrink-0 items-center justify-between px-4 pt-4 pb-2">
      <h1 class="ml-1 text-4xl font-extrabold tracking-[-0.01em]">{{ t('shoppingLists.title') }}</h1>
      <RouterLink
        :to="{ name: 'account' }"
        :aria-label="t('app.openAccountPageAria')"
        class="flex h-12 w-12 items-center justify-center rounded-full bg-[#243039] focus-visible:outline-3 focus-visible:outline-accent"
      >
        <UserAvatar
          :id="authStore.user?.id ?? ''"
          :name="authStore.user?.displayName ?? 'U'"
          :image-url="authStore.user?.imageUrl"
          color="#8ED9C9"
          class="h-9 w-9 text-base"
        />
      </RouterLink>
    </header>

    <main class="flex min-h-0 flex-1 flex-col gap-5.5 overflow-y-auto pt-3 pr-2.5 pb-[140px] pl-4">
      <p v-if="isLoading" class="flex flex-1 items-center justify-center text-text-secondary">
        {{ t('shoppingLists.loading') }}
      </p>

      <div v-else-if="errorMessage" class="flex flex-1 items-center justify-center px-2">
        <p role="alert" class="rounded-xl border border-danger/40 bg-danger/15 px-4 py-3 text-sm font-semibold text-white">
          {{ errorMessage }}
        </p>
      </div>

      <template v-else>
        <section v-if="invitations.length > 0" class="flex flex-col gap-2.5">
          <h2 class="text-[22px] font-extrabold">{{ t('shoppingLists.invitations') }}</h2>
          <ul class="flex flex-col gap-3.5">
            <li v-for="invitation in invitations" :key="invitation.id">
              <InvitationCard
                :invitation="invitation"
                :busy="acceptingInvitationId === invitation.id || decliningInvitationId === invitation.id"
                :error-message="failingInvitationId === invitation.id ? invitationErrorMessage : ''"
                @accept="acceptInvitation(invitation)"
                @decline="declineInvitation(invitation)"
              />
            </li>
          </ul>
        </section>

        <ul v-if="shoppingLists.length > 0" :aria-label="t('shoppingLists.title')" class="flex flex-col gap-3.5">
          <li v-for="shoppingList in shoppingLists" :key="shoppingList.id" data-testid="list-card">
            <ShoppingListCard :shopping-list="shoppingList" />
          </li>
        </ul>

        <p
          v-if="shoppingLists.length === 0 && invitations.length === 0"
          class="flex flex-1 items-center justify-center text-text-secondary"
        >
          {{ t('shoppingLists.noShoppingLists') }}
        </p>
      </template>
    </main>

    <CreateListSheet
      v-model:name="newShoppingListName"
      :is-open="isCreateFormVisible"
      :is-creating="isCreating"
      :error-message="createErrorMessage"
      @open="openCreateForm"
      @close="closeCreateForm"
      @submit="createShoppingList"
    />
  </div>
</template>
