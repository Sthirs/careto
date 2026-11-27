import { computed, getCurrentScope, onScopeDispose, ref, watch, type ComputedRef, type Ref } from 'vue';

import { createOverrideUpdate } from '@/composables/listItemOverrideUpdate';
import { useItemCatalog } from '@/composables/useItemCatalog';
import { api } from '@/lib/api';
import { applyPending } from '@/lib/offline/applyPending';
import { browserOnline } from '@/lib/offline/connectivity';
import { readListSnapshot, saveListSnapshot } from '@/lib/offline/listSnapshot';
import { isTransientFailure } from '@/lib/offline/networkErrors';
import {
  enqueue,
  onOutboxEvent,
  pendingOps,
  syncState,
  type OutboxEvent,
  type OutboxOp,
} from '@/lib/offline/outbox';
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

export { NeedsConnectionError } from '@/composables/listItemOverrideUpdate';

/**
 * The items of one list. Adds, status changes and removals go through the
 * offline outbox (ADR-0030): they show at once, survive a reload and reach the
 * server in order. Overrides still need the server and are rolled back if the
 * request fails; callers surface the rethrown error.
 */
export function useListItems(
  shoppingListId: () => string,
  hooks: {
    onRejected?: (event: Extract<OutboxEvent, { type: 'rejected' }>) => void;
    /** Changes of this list waited too long to sync and were dropped (ADR-0031). */
    onExpired?: () => void;
  } = {},
): UseListItemsReturn {
  const serverItems = ref<ListItem[]>([]);
  const serverCustomItems = ref<CustomItem[]>([]);
  const sectionOrder = ref<string[]>([]);
  const overrides = ref<SavedItemOverride[]>([]);
  const fromOfflineCopy = ref(false);
  // Ops another tab just sent: still shown until a reload has their result.
  const heldOps = ref<OutboxOp[]>([]);
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
      [...heldOps.value, ...pendingOps.value].filter((op) => op.listId === shoppingListId()),
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

  type SyncedEvent = Extract<OutboxEvent, { type: 'synced' }>;
  const applySynced = ({ op, item }: SyncedEvent) => {
    if (op.kind === 'remove') serverItems.value = serverItems.value.filter((existing) => existing.id !== op.itemId);
    else if (item) upsert(item);
  };

  // Loads can overlap (outbox events, reconnects); only the latest one counts.
  let latestLoad = 0;
  let loadsInFlight = 0;
  // Answers that landed while a load was in flight: its data may predate them.
  let syncedDuringLoad: SyncedEvent[] = [];
  // The first load that releases `heldOps` (one started after they were held).
  let heldUntilLoad = 0;

  /** Adopts what the latest load returned, without losing a change that synced meanwhile. */
  const adoptLoaded = (load: number, data: ListItemsResponse) => {
    adopt(data);
    const missed = syncedDuringLoad;
    syncedDuringLoad = [];
    missed.forEach(applySynced);
    if (load >= heldUntilLoad) heldOps.value = [];
    // A change synced while this load was in flight: fetch the final state.
    if (missed.length > 0) reloadQuietly();
  };

  const loadItems = async () => {
    const load = ++latestLoad;
    loadsInFlight += 1;
    try {
      const { data } = await api.get<ListItemsResponse>(base());
      if (load !== latestLoad) return;
      adoptLoaded(load, data);
      fromOfflineCopy.value = false;
      saveSnapshot();
    } catch (error: unknown) {
      if (load !== latestLoad) return;
      const id = userId();
      const copy = id && isTransientFailure(error) ? readListSnapshot(id, shoppingListId())?.items : null;
      if (!copy) {
        if (load >= heldUntilLoad) heldOps.value = [];
        throw error;
      }
      adoptLoaded(load, copy);
      fromOfflineCopy.value = true;
    } finally {
      loadsInFlight -= 1;
    }
  };

  function reloadQuietly() {
    loadItems().catch(() => undefined);
  }

  const ofThisList = (op: OutboxOp) => op.listId === shoppingListId();
  const stopListening = onOutboxEvent((event) => {
    if (event.type === 'changedElsewhere') {
      const sent = event.removed.filter(ofThisList);
      if (sent.length > 0) {
        heldOps.value = [...heldOps.value, ...sent];
        heldUntilLoad = latestLoad + 1;
      }
      return reloadQuietly();
    }
    if (event.type === 'expired') {
      if (!event.ops.some(ofThisList)) return;
      hooks.onExpired?.();
      return reloadQuietly();
    }
    if (!ofThisList(event.op)) return;
    if (event.type === 'rejected') {
      hooks.onRejected?.(event);
      return reloadQuietly();
    }
    applySynced(event);
    if (loadsInFlight > 0) syncedDuringLoad = [...syncedDuringLoad, event];
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
  // Back online while showing the device copy: fetch the current list once.
  const stopOnline = watch(browserOnline, (online) => {
    if (online && fromOfflineCopy.value) reloadQuietly();
  });
  if (getCurrentScope()) {
    onScopeDispose(() => {
      stopListening();
      stopWatching();
      stopOnline();
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

  const setOverride = createOverrideUpdate({
    serverItems,
    overrides,
    upsert,
    itemsUrl: base,
    saveSnapshot,
  });

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
