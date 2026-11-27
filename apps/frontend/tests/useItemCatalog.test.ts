import { flushPromises } from '@vue/test-utils';
import { AxiosError } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', () => ({ api: { get: vi.fn() } }));

import { resetItemCatalogCache, useItemCatalog } from '@/composables/useItemCatalog';
import { api } from '@/lib/api';
import { browserOnline } from '@/lib/offline/connectivity';

const OLD = { sections: [], items: [{ key: 'milk', sectionKey: 'milk-cheese' }] };
const NEW = { sections: [], items: [...OLD.items, { key: 'oat-milk', sectionKey: 'milk-cheese' }] };

describe('useItemCatalog offline copy (ADR-0030)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    resetItemCatalogCache();
    browserOnline.value = true;
  });

  it('fetches the catalog again once back online after starting from the device copy', async () => {
    localStorage.setItem('careto.offline.catalog', JSON.stringify(OLD));
    vi.mocked(api.get).mockRejectedValueOnce(new AxiosError('Network Error', 'ERR_NETWORK'));
    const { catalog, loadCatalog } = useItemCatalog();

    browserOnline.value = false;
    await loadCatalog();
    expect(catalog.value).toEqual(OLD);

    vi.mocked(api.get).mockResolvedValue({ data: NEW });
    browserOnline.value = true;
    await flushPromises();
    expect(catalog.value).toEqual(NEW);

    // Fetched for real now: no further request.
    await loadCatalog();
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  it('tries the server again on the next load while it shows the device copy', async () => {
    localStorage.setItem('careto.offline.catalog', JSON.stringify(OLD));
    vi.mocked(api.get).mockRejectedValueOnce(new AxiosError('Network Error', 'ERR_NETWORK'));
    const { catalog, loadCatalog } = useItemCatalog();
    await loadCatalog();

    vi.mocked(api.get).mockResolvedValue({ data: NEW });
    await loadCatalog();
    expect(catalog.value).toEqual(NEW);
  });
});
