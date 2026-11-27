import type { Ref } from 'vue';

import { api } from '@/lib/api';
import { isTransientFailure } from '@/lib/offline/networkErrors';
import { isTempId } from '@/lib/offline/outboxOps';
import type { ListItem, ListItemOverride, SavedItemOverride } from '@/types/listItem';

/** Thrown when a change needs the server and the item is not on it yet. */
export class NeedsConnectionError extends Error {
  constructor() {
    super('This change needs a connection.');
  }
}

type OverrideState = {
  serverItems: Ref<ListItem[]>;
  overrides: Ref<SavedItemOverride[]>;
  upsert: (item: ListItem) => void;
  itemsUrl: () => string;
  saveSnapshot: () => void;
};

/**
 * The icon or store section chosen in the item menu (ADR-0026, ADR-0029).
 * Online only (ADR-0030): it is rolled back if the request fails, and the
 * rethrown error is for the caller to surface.
 */
export function createOverrideUpdate(state: OverrideState) {
  const { serverItems, overrides, upsert, itemsUrl, saveSnapshot } = state;

  // Keeps `overrides` in step with an item the server just answered.
  const rememberOverride = (item: ListItem) => {
    const customItemId = item.customItem?.id ?? null;
    const sectionKey = item.sectionKey === item.defaultSectionKey ? null : item.sectionKey;
    const rest = overrides.value.filter((saved) =>
      customItemId
        ? saved.customItemId !== customItemId
        : saved.catalogItemKey !== item.catalogItemKey,
    );
    overrides.value =
      item.iconKey || sectionKey
        ? [...rest, { catalogItemKey: item.catalogItemKey, customItemId, iconKey: item.iconKey, sectionKey }]
        : rest;
  };

  return async (item: ListItem, override: ListItemOverride): Promise<void> => {
    if (isTempId(item.id)) throw new NeedsConnectionError();
    const previous = serverItems.value.find((existing) => existing.id === item.id);
    if (!previous) return;
    upsert(
      'iconKey' in override
        ? { ...previous, iconKey: override.iconKey }
        : { ...previous, sectionKey: override.sectionKey ?? previous.defaultSectionKey },
    );
    try {
      const { data } = await api.patch<{ item: ListItem }>(`${itemsUrl()}/${item.id}`, override);
      upsert(data.item);
      rememberOverride(data.item);
      saveSnapshot();
    } catch (error: unknown) {
      upsert(previous);
      throw isTransientFailure(error) ? new NeedsConnectionError() : error;
    }
  };
}
