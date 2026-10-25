<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import AccountAvatarLink from '@/components/AccountAvatarLink.vue';
import ListSectionsDock from '@/components/list-sections/ListSectionsDock.vue';
import ScreenHeader from '@/components/ScreenHeader.vue';
import { goBackTo } from '@/lib/backNavigation';

// Dishes and Week share this screen until their features are built.
const props = defineProps<{ section: 'list-dishes' | 'list-week' }>();

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const shoppingListId = computed(() => route.params.id as string);
const shoppingListName: string | undefined = history.state?.shoppingListName
  ? String(history.state.shoppingListName)
  : undefined;
const title = computed(() => t(props.section === 'list-dishes' ? 'listSections.dishes' : 'listSections.week'));

// Every list section goes back to My lists (ADR-0022).
const goBack = () => {
  goBackTo(router, { name: 'shoppingLists' });
};
</script>

<template>
  <div class="relative mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col overflow-hidden">
    <ScreenHeader :title="title" :back-label="t('shoppingListDetail.backToShoppingLists')" @back="goBack">
      <template #trailing><AccountAvatarLink /></template>
    </ScreenHeader>

    <main class="flex min-h-0 flex-1 items-center justify-center px-4 pb-[140px] text-text-secondary">
      <p data-testid="section-coming-soon">{{ t('listSections.comingSoon') }}</p>
    </main>

    <ListSectionsDock :shopping-list-id="shoppingListId" :shopping-list-name="shoppingListName" :current="section" />
  </div>
</template>
