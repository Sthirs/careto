import { computed, ref } from 'vue';

import { useItemCatalog } from '@/composables/useItemCatalog';
import { api } from '@/lib/api';
import { moveBefore, sameOrder } from '@/lib/sectionOrder';

const OWN_ITEMS = 'own-items';

type SectionOrderResponse = { sectionKeys: string[] };

/**
 * The store section order of one list, edited locally and saved as a whole
 * (ADR-0026). "Own items" is never part of it: it always comes last.
 */
export function useStoreSections(shoppingListId: () => string) {
  const { catalog, loadCatalog } = useItemCatalog();
  const order = ref<string[]>([]);
  const isSaving = ref(false);
  const path = () => `/lists/${shoppingListId()}/section-order`;

  const defaultOrder = computed(() =>
    (catalog.value?.sections ?? []).map((section) => section.key).filter((key) => key !== OWN_ITEMS),
  );
  const itemCounts = computed(() => {
    const counts = new Map<string, number>();
    for (const item of catalog.value?.items ?? []) {
      counts.set(item.sectionKey, (counts.get(item.sectionKey) ?? 0) + 1);
    }
    return counts;
  });

  const load = async () => {
    const [{ data }] = await Promise.all([api.get<SectionOrderResponse>(path()), loadCatalog()]);
    order.value = data.sectionKeys;
  };

  const move = (from: number, insertAt: number) => {
    order.value = moveBefore(order.value, from, insertAt);
  };

  const reset = () => {
    order.value = [...defaultOrder.value];
  };

  // The default order is saved by dropping the list's own (ADR-0026).
  const save = async () => {
    isSaving.value = true;
    try {
      const { data } = sameOrder(order.value, defaultOrder.value)
        ? await api.delete<SectionOrderResponse>(path())
        : await api.put<SectionOrderResponse>(path(), { sectionKeys: order.value });
      order.value = data.sectionKeys;
    } finally {
      isSaving.value = false;
    }
  };

  return { order, itemCounts, isSaving, load, move, reset, save };
}
