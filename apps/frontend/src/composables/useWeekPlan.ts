import { ref, type Ref } from 'vue';

import { api } from '@/lib/api';
import { withSlot } from '@/lib/weekPlan';
import type { WeekMeal, WeekSlot } from '@/types/weekPlan';

export type UseWeekPlanReturn = {
  slots: Ref<WeekSlot[]>;
  loadPlan: () => Promise<void>;
  setSlot: (weekday: number, meal: WeekMeal, dishId: string | null) => Promise<void>;
  replacePlan: (slots: WeekSlot[]) => Promise<void>;
  addToList: () => Promise<void>;
};

type PlanResponse = { data: { slots: WeekSlot[] } };

/**
 * The week plan of one list (ADR-0025). Each change shows at once and rolls
 * back if the request fails; callers surface the rethrown error.
 */
export function useWeekPlan(shoppingListId: () => string): UseWeekPlanReturn {
  const slots = ref<WeekSlot[]>([]);
  const base = () => `/lists/${shoppingListId()}/week`;

  const optimistic = async (next: WeekSlot[], request: () => Promise<PlanResponse>) => {
    const previous = slots.value;
    slots.value = next;
    try {
      slots.value = (await request()).data.slots;
    } catch (error: unknown) {
      slots.value = previous;
      throw error;
    }
  };

  const loadPlan = async () => {
    const { data } = await api.get<{ slots: WeekSlot[] }>(base());
    slots.value = data.slots;
  };

  const setSlot = (weekday: number, meal: WeekMeal, dishId: string | null) =>
    optimistic(withSlot(slots.value, weekday, meal, dishId), () =>
      api.put<{ slots: WeekSlot[] }>(`${base()}/slots`, { weekday, meal, dishId }),
    );

  const replacePlan = (next: WeekSlot[]) =>
    optimistic(next, () => api.put<{ slots: WeekSlot[] }>(base(), { slots: next }));

  const addToList = async () => {
    await api.post(`${base()}/list`);
  };

  return { slots, loadPlan, setSlot, replacePlan, addToList };
}
