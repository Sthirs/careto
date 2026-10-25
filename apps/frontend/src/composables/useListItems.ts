import { ref, type Ref } from 'vue';

import { api } from '@/lib/api';
import type {
  AddItemInput,
  CustomItem,
  ListItem,
  ListItemsResponse,
  ListItemStatus,
} from '@/types/listItem';

export type UseListItemsReturn = {
  items: Ref<ListItem[]>;
  customItems: Ref<CustomItem[]>;
  sectionOrder: Ref<string[]>;
  loadItems: () => Promise<void>;
  addItem: (input: AddItemInput) => Promise<ListItem>;
  setStatus: (item: ListItem, status: ListItemStatus) => Promise<void>;
  removeItem: (item: ListItem) => Promise<void>;
};

/**
 * The items of one list. Status changes and removals are applied at once and
 * rolled back if the request fails; callers surface the rethrown error.
 */
export function useListItems(shoppingListId: () => string): UseListItemsReturn {
  const items = ref<ListItem[]>([]);
  const customItems = ref<CustomItem[]>([]);
  const sectionOrder = ref<string[]>([]);
  const base = () => `/lists/${shoppingListId()}/items`;

  const upsert = (item: ListItem) => {
    const index = items.value.findIndex((existing) => existing.id === item.id);
    if (index === -1) items.value.push(item);
    else items.value.splice(index, 1, item);
  };

  const loadItems = async () => {
    const { data } = await api.get<ListItemsResponse>(base());
    items.value = data.items;
    customItems.value = data.customItems;
    sectionOrder.value = data.sectionOrder;
  };

  const addItem = async (input: AddItemInput) => {
    const { data } = await api.post<{ item: ListItem }>(base(), input);
    upsert(data.item);
    const custom = data.item.customItem;
    if (custom && !customItems.value.some((existing) => existing.id === custom.id)) {
      customItems.value.push(custom);
    }
    return data.item;
  };

  const setStatus = async (item: ListItem, status: ListItemStatus) => {
    const previous = { ...item };
    upsert({
      ...item,
      status,
      lastBoughtAt: status === 'bought' ? new Date().toISOString() : item.lastBoughtAt,
    });
    try {
      const { data } = await api.patch<{ item: ListItem }>(`${base()}/${item.id}`, { status });
      upsert(data.item);
    } catch (error: unknown) {
      upsert(previous);
      throw error;
    }
  };

  const removeItem = async (item: ListItem) => {
    const index = items.value.findIndex((existing) => existing.id === item.id);
    if (index === -1) return;
    items.value.splice(index, 1);
    try {
      await api.delete(`${base()}/${item.id}`);
    } catch (error: unknown) {
      items.value.splice(index, 0, item);
      throw error;
    }
  };

  return { items, customItems, sectionOrder, loadItems, addItem, setStatus, removeItem };
}
