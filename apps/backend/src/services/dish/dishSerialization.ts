import { Dish } from '../../entities/Dish';
import { DishIngredient } from '../../entities/DishIngredient';
import { OWN_ITEMS_SECTION_KEY } from '../catalog/catalogData';
import {
  serializeCustomItem,
  type SerializedCustomItem,
} from '../listItem/listItemSerialization';

export type SerializedDishIngredient = {
  id: string;
  catalogItemKey: string | null;
  customItem: SerializedCustomItem | null;
  sectionKey: string;
};

export type SerializedDish = {
  id: string;
  name: string;
  imageUrl: string | null;
  pausedUntil: string | null;
  lastAddedAt: string | null;
  /** Derived from the dish's open list links (ADR-0024). */
  inList: boolean;
  ingredients: SerializedDishIngredient[];
};

/** Expects `catalogItem` / `customItem` to be loaded. */
function serializeIngredient(ingredient: DishIngredient): SerializedDishIngredient {
  return {
    id: ingredient.id,
    catalogItemKey: ingredient.catalogItemKey,
    customItem: ingredient.customItem ? serializeCustomItem(ingredient.customItem) : null,
    sectionKey: ingredient.catalogItem?.sectionKey ?? OWN_ITEMS_SECTION_KEY,
  };
}

/** Expects `ingredients` (with their references) to be loaded. */
export function serializeDish(dish: Dish, inList: boolean): SerializedDish {
  return {
    id: dish.id,
    name: dish.name,
    imageUrl: dish.imageUrl,
    pausedUntil: dish.pausedUntil,
    lastAddedAt: dish.lastAddedAt ? dish.lastAddedAt.toISOString() : null,
    inList,
    ingredients: [...(dish.ingredients ?? [])]
      .sort((a, b) => a.position - b.position)
      .map(serializeIngredient),
  };
}
