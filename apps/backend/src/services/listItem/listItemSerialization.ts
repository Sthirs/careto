import { ListCustomItem } from '../../entities/ListCustomItem';
import { ListItem, ListItemSource, ListItemStatus } from '../../entities/ListItem';
import { OWN_ITEMS_SECTION_KEY } from '../catalog/catalogData';

export type SerializedCustomItem = { id: string; name: string };

export type SerializedListItem = {
  id: string;
  status: ListItemStatus;
  source: ListItemSource;
  lastBoughtAt: string | null;
  catalogItemKey: string | null;
  customItem: SerializedCustomItem | null;
  sectionKey: string;
};

export function serializeCustomItem(customItem: ListCustomItem): SerializedCustomItem {
  return { id: customItem.id, name: customItem.name };
}

/** Expects `catalogItem` / `customItem` to be loaded. */
export function serializeListItem(item: ListItem): SerializedListItem {
  return {
    id: item.id,
    status: item.status,
    source: item.source,
    lastBoughtAt: item.lastBoughtAt ? item.lastBoughtAt.toISOString() : null,
    catalogItemKey: item.catalogItemKey,
    customItem: item.customItem ? serializeCustomItem(item.customItem) : null,
    sectionKey: item.catalogItem?.sectionKey ?? OWN_ITEMS_SECTION_KEY,
  };
}
