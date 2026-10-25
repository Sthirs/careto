import { describe, expect, it, vi } from 'vitest';

const upserts: Array<{ entity: string; rows: unknown[]; conflict: string[] }> = [];

vi.mock('../src/db/data-source', () => ({
  AppDataSource: {
    transaction: async (run: (manager: unknown) => Promise<void>) =>
      run({
        getRepository: (entity: { name: string }) => ({
          upsert: async (rows: unknown[], conflict: string[]) => {
            upserts.push({ entity: entity.name, rows, conflict });
          },
        }),
      }),
  },
}));

import { CATALOG_SECTIONS } from '../src/services/catalog/catalogData';
import { catalogItemRows, catalogSectionRows, syncCatalog } from '../src/services/catalog/syncCatalog';

describe('syncCatalog', () => {
  it('orders sections by default position with own-items last', () => {
    const rows = catalogSectionRows();
    expect(rows[0]).toEqual({ key: 'fruits-vegetables', position: 0 });
    expect(rows.at(-1)).toEqual({ key: 'own-items', position: CATALOG_SECTIONS.length });
  });

  it('upserts sections before items, keyed by key (idempotent)', async () => {
    await syncCatalog();
    expect(upserts.map((u) => [u.entity, u.conflict])).toEqual([
      ['CatalogSection', ['key']],
      ['CatalogItem', ['key']],
    ]);
    expect(upserts[1].rows).toHaveLength(catalogItemRows().length);
    expect(catalogItemRows()).toContainEqual({ key: 'pineapple', sectionKey: 'fruits-vegetables' });
  });
});
