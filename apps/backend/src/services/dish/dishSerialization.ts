import { Dish } from '../../entities/Dish';
import { DishIngredient } from '../../entities/DishIngredient';
import { OWN_ITEMS_SECTION_KEY } from '../catalog/catalogData';
import { referenceKey, type ItemOverrideMap } from '../listItem/itemOverrides';
import {
  serializeCustomItem,
  type SerializedCustomItem,
} from '../listItem/listItemSerialization';

export type SerializedDishIngredient = {
  id: string;
  catalogItemKey: string | null;
  customItem: SerializedCustomItem | null;
  /** The list's chosen section for the item, else its own (ADR-0029). */
  sectionKey: string;
  /** The item's own section, before any override. */
  defaultSectionKey: string;
  /** The list's chosen icon for the item, if any (ADR-0029). */
  iconKey: string | null;
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
function serializeIngredient(
  ingredient: DishIngredient,
  overrides: ItemOverrideMap,
): SerializedDishIngredient {
  const defaultSectionKey = ingredient.catalogItem?.sectionKey ?? OWN_ITEMS_SECTION_KEY;
  const override = overrides.get(referenceKey(ingredient));
  return {
    id: ingredient.id,
    catalogItemKey: ingredient.catalogItemKey,
    customItem: ingredient.customItem ? serializeCustomItem(ingredient.customItem) : null,
    sectionKey: override?.sectionKey ?? defaultSectionKey,
    defaultSectionKey,
    iconKey: override?.iconKey ?? null,
  };
}

/**
 * Expects `ingredients` (with their references) to be loaded; `overrides` are
 * the list's icons and sections for its items (ADR-0029).
 */
export function serializeDish(
  dish: Dish,
  inList: boolean,
  overrides: ItemOverrideMap = new Map(),
): SerializedDish {
  return {
    id: dish.id,
    name: dish.name,
    imageUrl: dish.imageUrl,
    pausedUntil: dish.pausedUntil,
    lastAddedAt: dish.lastAddedAt ? dish.lastAddedAt.toISOString() : null,
    inList,
    ingredients: [...(dish.ingredients ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((ingredient) => serializeIngredient(ingredient, overrides)),
  };
}
