import { ref, watch, type Ref } from 'vue';

import { api } from '@/lib/api';
import { browserOnline } from '@/lib/offline/connectivity';
import { readCatalogSnapshot, saveCatalogSnapshot } from '@/lib/offline/listSnapshot';
import { isTransientFailure } from '@/lib/offline/networkErrors';
import type { Catalog } from '@/types/listItem';

// The catalog is the same for every list and only changes on deploy, so it is
// fetched once per page load and shared by every caller.
let pending: Promise<Catalog> | null = null;
const catalog = ref<Catalog | null>(null);
/** The catalog shown is the on-device copy: fetch it again when possible. */
let fromSnapshot = false;

/** Test seam: forget the cached catalog. */
export const resetItemCatalogCache = (): void => {
  pending = null;
  catalog.value = null;
  fromSnapshot = false;
};

const loadCatalog = async (): Promise<void> => {
  if (catalog.value && !fromSnapshot) return;
  pending ??= api.get<Catalog>('/catalog').then(({ data }) => {
    saveCatalogSnapshot(data);
    return data;
  });
  try {
    catalog.value = await pending;
    fromSnapshot = false;
  } catch (error: unknown) {
    pending = null;
    // Offline: the copy saved on the last load (ADR-0030).
    const copy = isTransientFailure(error) ? readCatalogSnapshot() : null;
    if (!copy) throw error;
    catalog.value = copy;
    fromSnapshot = true;
  }
};

// Back online after starting from the on-device copy: fetch the real one.
watch(browserOnline, (online) => {
  if (online && fromSnapshot) loadCatalog().catch(() => undefined);
});

export function useItemCatalog(): { catalog: Ref<Catalog | null>; loadCatalog: () => Promise<void> } {
  return { catalog, loadCatalog };
}
