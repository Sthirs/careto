import { ref, type Ref } from 'vue';

import { api } from '@/lib/api';
import type { Catalog } from '@/types/listItem';

// The catalog is the same for every list and only changes on deploy, so it is
// fetched once per page load and shared by every caller.
let pending: Promise<Catalog> | null = null;
const catalog = ref<Catalog | null>(null);

/** Test seam: forget the cached catalog. */
export const resetItemCatalogCache = (): void => {
  pending = null;
  catalog.value = null;
};

export function useItemCatalog(): { catalog: Ref<Catalog | null>; loadCatalog: () => Promise<void> } {
  const loadCatalog = async () => {
    if (catalog.value) return;
    pending ??= api.get<Catalog>('/catalog').then(({ data }) => data);
    try {
      catalog.value = await pending;
    } catch (error: unknown) {
      pending = null;
      throw error;
    }
  };

  return { catalog, loadCatalog };
}
