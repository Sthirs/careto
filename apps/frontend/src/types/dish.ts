import type { AddItemInput, CustomItem } from '@/types/listItem';

export type DishIngredient = {
  id: string;
  catalogItemKey: string | null;
  customItem: CustomItem | null;
  sectionKey: string;
};

export type Dish = {
  id: string;
  name: string;
  imageUrl: string | null;
  /** `YYYY-MM-DD`; paused while this date is after today. */
  pausedUntil: string | null;
  lastAddedAt: string | null;
  /** Derived by the server from the dish's open list links (ADR-0024). */
  inList: boolean;
  ingredients: DishIngredient[];
};

/** The body of `POST/PUT /lists/:id/dishes[/:dishId]`. */
export type DishInput = { name: string; ingredients: AddItemInput[] };
