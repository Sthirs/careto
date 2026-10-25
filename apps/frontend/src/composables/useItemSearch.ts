import { computed, type ComputedRef, type Ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { CUSTOM_ITEM_ICON, ITEM_ICONS, SECTION_ICONS } from '@/lib/itemIcons';
import { hasExactMatch, searchItems, type SearchEntry } from '@/lib/itemSearch';
import type { AddItemInput, Catalog, CustomItem, ListItem } from '@/types/listItem';

export type SearchResult = {
  id: string;
  label: string;
  icon: string;
  /** Already on the list and not bought: shown with the "In list" chip. */
  inList: boolean;
  /** The "add as a custom item" row for what was typed. */
  isNewCustom: boolean;
  input: AddItemInput;
};

/**
 * Search results for the list screen: matching catalog and custom items in
 * the active locale, then a row to add the query as a new custom item unless
 * something matches it exactly.
 */
export function useItemSearch(
  query: Ref<string>,
  catalog: Ref<Catalog | null>,
  customItems: Ref<CustomItem[]>,
  items: Ref<ListItem[]>,
): ComputedRef<SearchResult[]> {
  const { t, locale } = useI18n();

  const entries = computed<SearchEntry[]>(() => [
    ...(catalog.value?.items ?? []).map((item) => ({
      kind: 'catalog' as const,
      key: item.key,
      label: t(`catalog.items.${item.key}`),
    })),
    ...customItems.value.map((item) => ({ kind: 'custom' as const, id: item.id, label: item.name })),
  ]);

  const sectionOf = computed(
    () => new Map((catalog.value?.items ?? []).map((item) => [item.key, item.sectionKey])),
  );

  const toBuy = computed(
    () =>
      new Set(
        items.value
          .filter((item) => item.status === 'to_buy')
          .map((item) => item.catalogItemKey ?? item.customItem?.id),
      ),
  );

  return computed(() => {
    const typed = query.value.trim();
    if (!typed) return [];

    const results: SearchResult[] = searchItems(typed, entries.value, locale.value).map((entry) =>
      entry.kind === 'catalog'
        ? {
            id: `catalog:${entry.key}`,
            label: entry.label,
            icon:
              ITEM_ICONS[entry.key] ??
              SECTION_ICONS[sectionOf.value.get(entry.key) ?? ''] ??
              CUSTOM_ITEM_ICON,
            inList: toBuy.value.has(entry.key),
            isNewCustom: false,
            input: { catalogItemKey: entry.key },
          }
        : {
            id: `custom:${entry.id}`,
            label: entry.label,
            icon: CUSTOM_ITEM_ICON,
            inList: toBuy.value.has(entry.id),
            isNewCustom: false,
            input: { customItemId: entry.id },
          },
    );

    if (!hasExactMatch(typed, entries.value)) {
      results.push({
        id: 'new-custom',
        label: typed,
        icon: CUSTOM_ITEM_ICON,
        inList: false,
        isNewCustom: true,
        input: { customName: typed },
      });
    }
    return results;
  });
}
