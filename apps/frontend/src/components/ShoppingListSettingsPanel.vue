<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink } from 'vue-router';

import ItemIcon from '@/components/list-items/ItemIcon.vue';
import ListSectionsDock from '@/components/list-sections/ListSectionsDock.vue';
import ListCoverPicker from '@/components/list-settings/ListCoverPicker.vue';
import MemberInviteForm from '@/components/list-settings/MemberInviteForm.vue';
import MemberList from '@/components/list-settings/MemberList.vue';
import { useItemCatalog } from '@/composables/useItemCatalog';
import { useShoppingListSettings } from '@/composables/useShoppingListSettings';
import { sortableSectionKeys } from '@/lib/sectionOrder';
import type { ShoppingListDetail } from '@/types/shoppingList';

const props = defineProps<{
  shoppingList: ShoppingListDetail;
}>();

const emit = defineEmits<{
  updated: [];
}>();

const { t } = useI18n();

const SECTIONS_ICON = 'M8 6h12 M8 12h12 M8 18h12 M3 9l1.5-3L6 9 M3 15l1.5 3L6 15';

// "Own items" is not sortable (ADR-0026), so it is not counted.
const { catalog, loadCatalog } = useItemCatalog();
const sortableSectionCount = computed(() =>
  catalog.value ? sortableSectionKeys(catalog.value.sections.map((section) => section.key)).length : null,
);
// The count is a hint: the link still works without the catalog.
onMounted(() => loadCatalog().catch(() => {}));

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

    <section class="flex flex-col gap-3">
      <h2 class="text-[22px] font-extrabold">{{ t('shoppingListSettings.shoppingHeading') }}</h2>
      <RouterLink
        :to="{ name: 'list-store-sections', params: { id: props.shoppingList.id } }"
        data-testid="store-sections-link"
        class="flex min-h-18 items-center gap-4 rounded-xl bg-surface pr-4 pl-4.5 text-white no-underline focus-visible:outline-3 focus-visible:outline-accent"
      >
        <ItemIcon :path="SECTIONS_ICON" :size="26" :stroke-width="2" />
        <span class="flex flex-1 flex-col">
          <span class="text-lg font-extrabold">{{ t('shoppingListSettings.storeSections') }}</span>
          <span v-if="sortableSectionCount !== null" class="text-sm font-semibold text-[#C4CDD4]">
            {{ t('shoppingListSettings.storeSectionsHint', { count: sortableSectionCount }) }}
          </span>
        </span>
        <ItemIcon path="M9 6l6 6-6 6" :size="20" :stroke-width="2.4" class="text-[#C4CDD4]" />
      </RouterLink>
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
