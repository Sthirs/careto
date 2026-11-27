import { computed, getCurrentScope, onScopeDispose, ref, watch, type ComputedRef, type Ref } from 'vue';

import { useItemCatalog } from '@/composables/useItemCatalog';
import { api } from '@/lib/api';
import { applyPending } from '@/lib/offline/applyPending';
import { readListSnapshot, saveListSnapshot } from '@/lib/offline/listSnapshot';
import { isTransientFailure } from '@/lib/offline/networkErrors';
import { enqueue, onOutboxEvent, pendingOps, syncState, type OutboxEvent } from '@/lib/offline/outbox';
import { isTempId, newTempId } from '@/lib/offline/outboxOps';
import { useAuthStore } from '@/stores/auth';
import type {
  AddItemInput,
  CustomItem,
  ListItem,
  ListItemOverride,
  ListItemsResponse,
  ListItemStatus,
  SavedItemOverride,
} from '@/types/listItem';

export type UseListItemsReturn = {
  /** The server's items with the changes still waiting to sync applied (ADR-0030). */
  items: ComputedRef<ListItem[]>;
  customItems: ComputedRef<CustomItem[]>;
  sectionOrder: Ref<string[]>;
  /** The list's chosen icons and sections, for items on the list or not. */
  overrides: Ref<SavedItemOverride[]>;
  /** True while the list shows the on-device copy because the server was unreachable. */
  fromOfflineCopy: Ref<boolean>;
  loadItems: () => Promise<void>;
  addItem: (input: AddItemInput) => Promise<void>;
  setStatus: (item: ListItem, status: ListItemStatus) => Promise<void>;
  removeItem: (item: ListItem) => Promise<void>;
  setOverride: (item: ListItem, override: ListItemOverride) => Promise<void>;
};

/** Thrown when a change needs the server and the item is not on it yet. */
export class NeedsConnectionError extends Error {
  constructor() {
    super('This change needs a connection.');
  }
}

/**
 * The items of one list. Adds, status changes and removals go through the
 * offline outbox (ADR-0030): they show at once, survive a reload and reach the
 * server in order. Overrides still need the server and are rolled back if the
 * request fails; callers surface the rethrown error.
 */
export function useListItems(
  shoppingListId: () => string,
  hooks: { onRejected?: (event: Extract<OutboxEvent, { type: 'rejected' }>) => void } = {},
): UseListItemsReturn {
  const serverItems = ref<ListItem[]>([]);
  const serverCustomItems = ref<CustomItem[]>([]);
  const sectionOrder = ref<string[]>([]);
  const overrides = ref<SavedItemOverride[]>([]);
  const fromOfflineCopy = ref(false);
  const { catalog } = useItemCatalog();
  const authStore = useAuthStore();
  const base = () => `/lists/${shoppingListId()}/items`;
  const userId = () => authStore.user?.id ?? null;

  const sectionOf = computed(
    () => new Map((catalog.value?.items ?? []).map((item) => [item.key, item.sectionKey])),
  );
  const view = computed(() =>
    applyPending(
      serverItems.value,
      pendingOps.value.filter((op) => op.listId === shoppingListId()),
      {
        sectionOf: (key) => sectionOf.value.get(key),
        overrides: overrides.value,
        customItems: serverCustomItems.value,
      },
    ),
  );
  const items = computed(() => view.value.items);
  const customItems = computed(() => view.value.customItems);

  const snapshot = (): ListItemsResponse => ({
    sectionOrder: sectionOrder.value,
    items: serverItems.value,
    customItems: serverCustomItems.value,
    overrides: overrides.value,
  });
  const saveSnapshot = () => {
    const id = userId();
    if (id) saveListSnapshot(id, shoppingListId(), { items: snapshot() });
  };

  const adopt = (data: ListItemsResponse) => {
    serverItems.value = data.items;
    serverCustomItems.value = data.customItems;
    sectionOrder.value = data.sectionOrder;
    overrides.value = data.overrides ?? [];
  };

  const upsert = (item: ListItem) => {
    const index = serverItems.value.findIndex((existing) => existing.id === item.id);
    serverItems.value =
      index === -1
        ? [...serverItems.value, item]
        : serverItems.value.map((existing, at) => (at === index ? item : existing));
    const custom = item.customItem;
    if (custom && !serverCustomItems.value.some((existing) => existing.id === custom.id)) {
      serverCustomItems.value = [...serverCustomItems.value, custom];
    }
  };

  const loadItems = async () => {
    try {
      const { data } = await api.get<ListItemsResponse>(base());
      adopt(data);
      fromOfflineCopy.value = false;
      saveSnapshot();
    } catch (error: unknown) {
      const id = userId();
      const copy = id && isTransientFailure(error) ? readListSnapshot(id, shoppingListId())?.items : null;
      if (!copy) throw error;
      adopt(copy);
      fromOfflineCopy.value = true;
    }
  };

  const reloadQuietly = () => {
    loadItems().catch(() => undefined);
  };

  const stopListening = onOutboxEvent((event) => {
    if (event.type === 'changedElsewhere') return reloadQuietly();
    if (event.op.listId !== shoppingListId()) return;
    if (event.type === 'rejected') {
      hooks.onRejected?.(event);
      return reloadQuietly();
    }
    const { op } = event;
    if (op.kind === 'remove') {
      serverItems.value = serverItems.value.filter((item) => item.id !== op.itemId);
    } else if (event.item) {
      upsert(event.item);
    }
    saveSnapshot();
    // The first answer after an outage: catch up on what other members did.
    if (fromOfflineCopy.value) reloadQuietly();
  });
  // Back online after waiting: catch up on what other members did meanwhile.
  let waited = false;
  const stopWatching = watch(
    syncState,
    (state) => {
      if (state === 'waiting') waited = true;
      if (state === 'idle' && waited) {
        waited = false;
        reloadQuietly();
      }
    },
    { flush: 'sync' },
  );
  if (getCurrentScope()) {
    onScopeDispose(() => {
      stopListening();
      stopWatching();
    });
  }

  const addItem = async (input: AddItemInput) => {
    // A custom item typed offline has no server id yet: add it by name.
    const custom =
      'customItemId' in input && isTempId(input.customItemId)
        ? customItems.value.find((item) => item.id === input.customItemId)
        : undefined;
    enqueue({
      kind: 'add',
      listId: shoppingListId(),
      tempItemId: newTempId(),
      input: custom ? { customName: custom.name } : input,
    });
  };

  const setStatus = async (item: ListItem, status: ListItemStatus) => {
    enqueue({ kind: 'status', listId: shoppingListId(), itemId: item.id, status });
  };

  const removeItem = async (item: ListItem) => {
    enqueue({ kind: 'remove', listId: shoppingListId(), itemId: item.id });
  };

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

  // The icon or store section chosen in the item menu (ADR-0026, ADR-0029).
  const setOverride = async (item: ListItem, override: ListItemOverride) => {
    if (isTempId(item.id)) throw new NeedsConnectionError();
    const previous = serverItems.value.find((existing) => existing.id === item.id);
    if (!previous) return;
    upsert(
      'iconKey' in override
        ? { ...previous, iconKey: override.iconKey }
        : { ...previous, sectionKey: override.sectionKey ?? previous.defaultSectionKey },
    );
    try {
      const { data } = await api.patch<{ item: ListItem }>(`${base()}/${item.id}`, override);
      upsert(data.item);
      rememberOverride(data.item);
      saveSnapshot();
    } catch (error: unknown) {
      upsert(previous);
      throw isTransientFailure(error) ? new NeedsConnectionError() : error;
    }
  };

  return {
    items,
    customItems,
    sectionOrder,
    overrides,
    fromOfflineCopy,
    loadItems,
    addItem,
    setStatus,
    removeItem,
    setOverride,
  };
}
