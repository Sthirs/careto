import { computed, ref, watch, type Ref } from 'vue';

import type { ItemMenuTarget } from '@/components/list-items/ItemMenuSheet.vue';
import { useRoutedOverlay } from '@/composables/useRoutedOverlay';
import { iconForItem } from '@/lib/itemIcons';
import type { ListItem, ListItemOverride } from '@/types/listItem';

/** The icon a tile shows: the chosen one, else the item's own (ADR-0026). */
export const tileIconOf = (item: ListItem): string =>
  iconForItem(item.catalogItemKey, item.defaultSectionKey, item.iconKey);

/**
 * The ⋮ sheet of the list screen. The open sheet lives in the URL
 * (ADR-0019); the item it is for lives here, so a reload closes it.
 */
export function useItemMenu(
  items: Ref<ListItem[]>,
  labelOf: (item: ListItem) => string,
  actions: {
    remove: (id: string) => void;
    setOverride: (item: ListItem, override: ListItemOverride) => void;
  },
) {
  const overlay = useRoutedOverlay('item-menu');
  const itemId = ref<string | null>(null);
  const item = computed(() => items.value.find((candidate) => candidate.id === itemId.value) ?? null);

  watch(
    () => overlay.isOpen.value,
    (isOpen) => {
      if (isOpen && !item.value) overlay.close();
    },
    { immediate: true },
  );

  const target = computed<ItemMenuTarget | null>(() => {
    const current = item.value;
    if (!current) return null;
    return {
      name: labelOf(current),
      icon: tileIconOf(current),
      isCustom: current.customItem !== null,
      iconKey: current.iconKey ?? current.catalogItemKey,
      sectionKey: current.sectionKey,
    };
  });

  const open = (id: string) => {
    itemId.value = id;
    overlay.open();
  };

  const remove = () => {
    const current = item.value;
    overlay.close();
    if (current) actions.remove(current.id);
  };

  // Picking the item's own icon or section clears the override. The sheet
  // stays open and goes back to the item's actions.
  const saveIcon = (iconKey: string) => {
    const current = item.value;
    if (current) {
      actions.setOverride(current, { iconKey: iconKey === current.catalogItemKey ? null : iconKey });
    }
  };

  const saveSection = (sectionKey: string) => {
    const current = item.value;
    if (current) {
      actions.setOverride(current, {
        sectionKey: sectionKey === current.defaultSectionKey ? null : sectionKey,
      });
    }
  };

  return {
    isOpen: computed(() => overlay.isOpen.value && item.value !== null),
    target,
    open,
    close: overlay.close,
    remove,
    saveIcon,
    saveSection,
  };
}
