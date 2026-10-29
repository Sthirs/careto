<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import AccountAvatarLink from '@/components/AccountAvatarLink.vue';
import ListSectionsDock from '@/components/list-sections/ListSectionsDock.vue';
import ScreenHeader from '@/components/ScreenHeader.vue';
import UndoToast from '@/components/UndoToast.vue';
import AddPlanButton, { type AddPlanState } from '@/components/week/AddPlanButton.vue';
import NewPlanSheet from '@/components/week/NewPlanSheet.vue';
import WeekDishPicker from '@/components/week/WeekDishPicker.vue';
import WeekSlotCard from '@/components/week/WeekSlotCard.vue';
import { useDishes } from '@/composables/useDishes';
import { useRoutedOverlay } from '@/composables/useRoutedOverlay';
import { useWeekPlan } from '@/composables/useWeekPlan';
import { goBackTo } from '@/lib/backNavigation';
import { buildWeek, plannedCount, SLOT_COUNT, weekdayName } from '@/lib/weekPlan';
import type { Dish } from '@/types/dish';
import type { WeekMeal } from '@/types/weekPlan';

const { t, locale } = useI18n();
const route = useRoute();
const router = useRouter();

const shoppingListId = computed(() => route.params.id as string);
const shoppingListName: string | undefined = history.state?.shoppingListName
  ? String(history.state.shoppingListName)
  : undefined;

const isLoading = ref(true);
const errorMessage = ref('');
const actionError = ref('');
const announcement = ref('');
const toast = ref<{ text: string; undo: () => Promise<void> } | null>(null);

const { dishes, loadDishes } = useDishes(() => shoppingListId.value);
const { slots, loadPlan, setSlot, replacePlan, addToList } = useWeekPlan(() => shoppingListId.value);

const week = computed(() => buildWeek(slots.value, dishes.value));
const planned = computed(() => plannedCount(week.value));

const mealLabel = (meal: WeekMeal) => t(`week.meals.${meal}`);
const slotName = (weekday: number, meal: WeekMeal) =>
  t('week.slotName', { day: weekdayName(weekday, locale.value), meal: t(`week.mealsInText.${meal}`) });

// The slot the picker is for; the overlay itself lives in the URL (ADR-0019).
const picker = useRoutedOverlay('week-dish');
const newPlan = useRoutedOverlay('week-new-plan');
const picking = ref<{ weekday: number; meal: WeekMeal; dish: Dish | null } | null>(null);
const pickerOpen = computed(() => picker.isOpen.value && picking.value !== null);

// A reload with the picker in the URL has no slot to pick for.
watch(
  () => picker.isOpen.value,
  (isOpen) => {
    if (isOpen && !picking.value) picker.close();
  },
  { immediate: true },
);

const load = async () => {
  isLoading.value = true;
  errorMessage.value = '';
  try {
    await Promise.all([loadDishes(), loadPlan()]);
  } catch {
    errorMessage.value = t('week.loadFailed');
  } finally {
    isLoading.value = false;
  }
};

const run = async (action: () => Promise<unknown>) => {
  actionError.value = '';
  try {
    await action();
    return true;
  } catch {
    actionError.value = t('week.actionFailed');
    return false;
  }
};

const openPicker = (weekday: number, meal: WeekMeal, dish: Dish | null) => {
  toast.value = null;
  picking.value = { weekday, meal, dish };
  picker.open();
};

const choose = (dish: Dish) => {
  const slot = picking.value;
  picker.close();
  if (slot && slot.dish?.id !== dish.id) void run(() => setSlot(slot.weekday, slot.meal, dish.id));
};

const removeSlot = async (weekday: number, meal: WeekMeal, dish: Dish) => {
  if (!(await run(() => setSlot(weekday, meal, null)))) return;
  toast.value = {
    text: t('week.removed', { dish: dish.name, slot: slotName(weekday, meal) }),
    undo: () => setSlot(weekday, meal, dish.id),
  };
};

const clearFromPicker = () => {
  const slot = picking.value;
  picker.close();
  if (slot?.dish) void removeSlot(slot.weekday, slot.meal, slot.dish);
};

const openNewPlan = () => {
  toast.value = null;
  newPlan.open();
};

const clearAll = async () => {
  const previous = [...slots.value];
  newPlan.close();
  if (!(await run(() => replacePlan([])))) return;
  toast.value = { text: t('week.cleared'), undo: () => replacePlan(previous) };
};

const undo = () => {
  const action = toast.value?.undo;
  toast.value = null;
  if (action) void run(action);
};

/** How long the button says the ingredients were added. */
const ADDED_MS = 2500;
const addState = ref<AddPlanState>('idle');
let addedTimer: ReturnType<typeof setTimeout> | undefined;

const addPlanToList = async () => {
  if (addState.value === 'adding') return;
  clearTimeout(addedTimer);
  announcement.value = '';
  addState.value = 'adding';
  if (!(await run(addToList))) {
    addState.value = 'idle';
    return;
  }
  addState.value = 'added';
  announcement.value = t('week.addedAnnouncement');
  addedTimer = setTimeout(() => (addState.value = 'idle'), ADDED_MS);
};

onBeforeUnmount(() => clearTimeout(addedTimer));

// Every list section goes back to My lists (ADR-0022).
const goBack = () => {
  goBackTo(router, { name: 'shoppingLists' });
};

onMounted(load);
</script>

<template>
  <div class="relative mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col overflow-hidden">
    <ScreenHeader :title="t('listSections.week')" :back-label="t('shoppingListDetail.backToShoppingLists')" @back="goBack">
      <template #trailing><AccountAvatarLink /></template>
    </ScreenHeader>

    <main class="flex min-h-0 flex-1 flex-col gap-4.5 overflow-y-auto pt-2 pr-2.5 pb-[200px] pl-4">
      <p v-if="isLoading" class="flex flex-1 items-center justify-center text-text-secondary">
        {{ t('week.loading') }}
      </p>
      <div v-else-if="errorMessage" class="flex flex-1 items-center justify-center px-2">
        <p role="alert" class="rounded-xl border border-danger/40 bg-danger/15 px-4 py-3 text-sm font-semibold text-white">
          {{ errorMessage }}
        </p>
      </div>
      <template v-else>
        <p v-if="actionError" role="alert" class="m-0 rounded-xl border border-danger/40 bg-danger/15 px-4 py-3 text-sm font-semibold text-white">
          {{ actionError }}
        </p>
        <div class="flex items-center justify-between gap-3">
          <span class="text-[15px] font-bold text-text-muted" data-testid="week-planned-count">
            {{ t('week.plannedCount', { count: planned, total: SLOT_COUNT }) }}
          </span>
          <button
            type="button"
            class="flex h-11 items-center gap-2 rounded-full border-2 border-outline pr-4 pl-3 text-[15px] font-extrabold text-white focus-visible:outline-3 focus-visible:outline-accent"
            @click="openNewPlan"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M4 12a8 8 0 0 1 14-5.3L20 9 M20 4v5h-5 M20 12a8 8 0 0 1-14 5.3L4 15 M4 20v-5h5" />
            </svg>
            {{ t('week.newPlan') }}
          </button>
        </div>
        <section v-for="day in week" :key="day.weekday" class="flex flex-col gap-2">
          <h2 class="m-0 text-xl font-extrabold">{{ weekdayName(day.weekday, locale) }}</h2>
          <div class="grid grid-cols-2 gap-2.5">
            <WeekSlotCard
              v-for="cell in day.cells"
              :key="cell.meal"
              :dish="cell.dish"
              :meal-label="mealLabel(cell.meal)"
              :slot-name="slotName(cell.weekday, cell.meal)"
              @pick="openPicker(cell.weekday, cell.meal, cell.dish)"
              @remove="cell.dish && removeSlot(cell.weekday, cell.meal, cell.dish)"
            />
          </div>
        </section>
      </template>
      <p class="sr-only" aria-live="polite">{{ announcement }}</p>
    </main>

    <UndoToast v-if="toast" :text="toast.text" @undo="undo" @dismiss="toast = null" />

    <ListSectionsDock :shopping-list-id="shoppingListId" :shopping-list-name="shoppingListName" current="list-week">
      <AddPlanButton :state="addState" :disabled="planned === 0" @add="addPlanToList" />
    </ListSectionsDock>

    <WeekDishPicker
      :open="pickerOpen"
      :slot-name="picking ? slotName(picking.weekday, picking.meal) : ''"
      :dishes="dishes"
      :current="picking?.dish ?? null"
      @close="picker.close"
      @choose="choose"
      @clear="clearFromPicker"
    />
    <NewPlanSheet :open="newPlan.isOpen.value" :count="planned" @close="newPlan.close" @confirm="clearAll" />
  </div>
</template>
