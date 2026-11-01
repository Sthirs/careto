import { computed, onBeforeUnmount, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import type { SearchResult } from '@/composables/useItemSearch';
import { api } from '@/lib/api';
import { iconForItem } from '@/lib/itemIcons';
import type { Dish, DishIngredient } from '@/types/dish';
import type { AddItemInput } from '@/types/listItem';

/** One row of the ingredient list, before or after the dish is saved. */
export type IngredientEntry = { key: string; label: string; icon: string; input: AddItemInput };

/**
 * State and requests behind the New dish and Dish screens. With no `dishId`
 * the form creates a dish and uploads the picked photo after it exists; with
 * one it edits that dish, and photo, pause and delete apply at once.
 */
export function useDishForm(shoppingListId: () => string, dishId: () => string | undefined) {
  const { t } = useI18n();

  const name = ref('');
  const ingredients = ref<IngredientEntry[]>([]);
  const imageUrl = ref<string | null>(null);
  const pendingImage = ref<File | null>(null);
  const pausedUntil = ref<string | null>(null);
  const lastAddedAt = ref<string | null>(null);
  const isSaving = ref(false);

  const base = () => `/lists/${shoppingListId()}/dishes`;
  const canSave = computed(
    () => name.value.trim().length > 0 && ingredients.value.length > 0 && !isSaving.value,
  );

  /** Catalog keys and custom ids already picked, for the search's "Added" chip. */
  const takenKeys = computed(
    () =>
      new Set(
        ingredients.value.flatMap((entry) =>
          'catalogItemKey' in entry.input
            ? [entry.input.catalogItemKey]
            : 'customItemId' in entry.input
              ? [entry.input.customItemId]
              : [],
        ),
      ),
  );

  // The same icon the item has on the list, chosen one included (ADR-0029).
  const entryOf = (ingredient: DishIngredient): IngredientEntry => {
    const icon = iconForItem(
      ingredient.catalogItemKey,
      ingredient.defaultSectionKey,
      ingredient.iconKey,
    );
    return ingredient.customItem
      ? {
          key: `custom:${ingredient.customItem.id}`,
          label: ingredient.customItem.name,
          icon,
          input: { customItemId: ingredient.customItem.id },
        }
      : {
          key: `catalog:${ingredient.catalogItemKey}`,
          label: t(`catalog.items.${ingredient.catalogItemKey}`),
          icon,
          input: { catalogItemKey: ingredient.catalogItemKey as string },
        };
  };

  const apply = (dish: Dish) => {
    name.value = dish.name;
    ingredients.value = dish.ingredients.map(entryOf);
    imageUrl.value = dish.imageUrl;
    pausedUntil.value = dish.pausedUntil;
    lastAddedAt.value = dish.lastAddedAt;
  };

  const load = async () => {
    const id = dishId();
    if (!id) return;
    const { data } = await api.get<{ dish: Dish }>(`${base()}/${id}`);
    apply(data.dish);
  };

  const addIngredient = (result: SearchResult) => {
    const key = result.isNewCustom ? `new:${result.label.trim().toLowerCase()}` : result.id;
    if (result.taken || ingredients.value.some((entry) => entry.key === key)) return;
    ingredients.value.push({ key, label: result.label, icon: result.icon, input: result.input });
  };

  const removeIngredient = (key: string) => {
    ingredients.value = ingredients.value.filter((entry) => entry.key !== key);
  };

  const uploadImage = async (id: string, file: File) => {
    const form = new FormData();
    form.append('image', file);
    const { data } = await api.post<{ dish: Dish }>(`${base()}/${id}/image`, form);
    imageUrl.value = data.dish.imageUrl;
  };

  // New dish: keep the file and show it locally until the dish exists.
  const pickImage = async (file: File) => {
    const id = dishId();
    if (id) return uploadImage(id, file);
    if (imageUrl.value?.startsWith('blob:')) URL.revokeObjectURL(imageUrl.value);
    pendingImage.value = file;
    imageUrl.value = URL.createObjectURL(file);
  };

  const save = async () => {
    if (!canSave.value) return;
    isSaving.value = true;
    const body = { name: name.value.trim(), ingredients: ingredients.value.map((entry) => entry.input) };
    try {
      const id = dishId();
      if (id) {
        await api.put(`${base()}/${id}`, body);
        return;
      }
      const { data } = await api.post<{ dish: Dish }>(base(), body);
      // The dish is saved even if its photo fails; the photo can be added again from the Dish screen.
      if (pendingImage.value) await uploadImage(data.dish.id, pendingImage.value).catch(() => undefined);
    } finally {
      isSaving.value = false;
    }
  };

  const setPause = async (until: string | null) => {
    const { data } = await api.patch<{ dish: Dish }>(`${base()}/${dishId()}`, { pausedUntil: until });
    pausedUntil.value = data.dish.pausedUntil;
  };

  const remove = () => api.delete(`${base()}/${dishId()}`);

  onBeforeUnmount(() => {
    if (imageUrl.value?.startsWith('blob:')) URL.revokeObjectURL(imageUrl.value);
  });

  return {
    name,
    ingredients,
    imageUrl,
    pausedUntil,
    lastAddedAt,
    isSaving,
    canSave,
    takenKeys,
    load,
    addIngredient,
    removeIngredient,
    pickImage,
    save,
    setPause,
    remove,
  };
}
