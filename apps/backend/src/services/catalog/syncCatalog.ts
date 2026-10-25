import { AppDataSource } from '../../db/data-source';
import { CatalogItem } from '../../entities/CatalogItem';
import { CatalogSection } from '../../entities/CatalogSection';
import { CATALOG_SECTIONS, OWN_ITEMS_SECTION_KEY } from './catalogData';

/** Catalog sections in default order, `own-items` (custom items) last. */
export const catalogSectionRows = (): CatalogSection[] =>
  [...CATALOG_SECTIONS.map((section) => section.key), OWN_ITEMS_SECTION_KEY].map(
    (key, position) => ({ key, position }),
  );

export const catalogItemRows = (): CatalogItem[] =>
  CATALOG_SECTIONS.flatMap((section) =>
    section.items.map((key) => ({ key, sectionKey: section.key }) as CatalogItem),
  );

/**
 * Upserts the default catalog. Runs on every start, independent of the demo
 * seed, because production runs with `DB_SYNC=false` and still needs the
 * reference data. Never deletes: a key dropped from `catalogData.ts` stays
 * so the list items that use it keep resolving.
 */
export const syncCatalog = async (): Promise<void> => {
  await AppDataSource.transaction(async (manager) => {
    await manager.getRepository(CatalogSection).upsert(catalogSectionRows(), ['key']);
    await manager.getRepository(CatalogItem).upsert(catalogItemRows(), ['key']);
  });
};
