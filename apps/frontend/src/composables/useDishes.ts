import { ref, type Ref } from 'vue';

import { api } from '@/lib/api';
import type { Dish } from '@/types/dish';

export type UseDishesReturn = {
  dishes: Ref<Dish[]>;
  loadDishes: () => Promise<void>;
  addToList: (dish: Dish) => Promise<void>;
  removeFromList: (dish: Dish) => Promise<void>;
  resume: (dish: Dish) => Promise<void>;
};

/**
 * The dishes of one list. Each action moves the card at once and rolls back
 * if the request fails; callers surface the rethrown error.
 */
export function useDishes(shoppingListId: () => string): UseDishesReturn {
  const dishes = ref<Dish[]>([]);
  const base = () => `/lists/${shoppingListId()}/dishes`;

  const upsert = (dish: Dish) => {
    const index = dishes.value.findIndex((existing) => existing.id === dish.id);
    if (index === -1) dishes.value.push(dish);
    else dishes.value.splice(index, 1, dish);
  };

  const optimistic = async (dish: Dish, guess: Partial<Dish>, request: () => Promise<{ data: { dish: Dish } }>) => {
    const previous = { ...dish };
    upsert({ ...dish, ...guess });
    try {
      upsert((await request()).data.dish);
    } catch (error: unknown) {
      upsert(previous);
      throw error;
    }
  };

  const loadDishes = async () => {
    const { data } = await api.get<{ dishes: Dish[] }>(base());
    dishes.value = data.dishes;
  };

  const addToList = (dish: Dish) =>
    optimistic(dish, { inList: true }, () => api.post<{ dish: Dish }>(`${base()}/${dish.id}/list`));

  const removeFromList = (dish: Dish) =>
    optimistic(dish, { inList: false }, () => api.delete<{ dish: Dish }>(`${base()}/${dish.id}/list`));

  const resume = (dish: Dish) =>
    optimistic(dish, { pausedUntil: null }, () =>
      api.patch<{ dish: Dish }>(`${base()}/${dish.id}`, { pausedUntil: null }),
    );

  return { dishes, loadDishes, addToList, removeFromList, resume };
}
