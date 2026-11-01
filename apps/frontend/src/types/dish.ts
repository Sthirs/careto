import type { AddItemInput, CustomItem } from '@/types/listItem';

export type DishIngredient = {
  id: string;
  catalogItemKey: string | null;
  customItem: CustomItem | null;
  /** The list's chosen section for the item, else its own (ADR-0029). */
  sectionKey: string;
  /** The item's own section, before any override. */
  defaultSectionKey: string;
  /** The list's chosen icon for the item, if any (ADR-0029). */
  iconKey: string | null;
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
