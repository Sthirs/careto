export type ListItemStatus = 'to_buy' | 'bought';

export type CustomItem = {
  id: string;
  name: string;
};

export type ListItem = {
  id: string;
  status: ListItemStatus;
  source: 'user' | 'dish' | 'recurring';
  lastBoughtAt: string | null;
  catalogItemKey: string | null;
  customItem: CustomItem | null;
  sectionKey: string;
};

export type ListItemsResponse = {
  sectionOrder: string[];
  items: ListItem[];
  customItems: CustomItem[];
};

/** The default item catalog: keys only, labels come from `catalog.*` i18n. */
export type Catalog = {
  sections: Array<{ key: string }>;
  items: Array<{ key: string; sectionKey: string }>;
};

/** What the user picked to add: a catalog item, a custom item, or a new name. */
export type AddItemInput =
  | { catalogItemKey: string }
  | { customItemId: string }
  | { customName: string };
