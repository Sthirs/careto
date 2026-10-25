import { AppDataSource } from '../../db/data-source';
import { CatalogItem } from '../../entities/CatalogItem';
import { CatalogSection } from '../../entities/CatalogSection';

export type SerializedCatalog = {
  sections: Array<{ key: string }>;
  items: Array<{ key: string; sectionKey: string }>;
};

/** The default catalog in default section order (keys only, ADR-0014). */
export const getCatalog = async (): Promise<SerializedCatalog> => {
  const sections = await AppDataSource.getRepository(CatalogSection).find({
    order: { position: 'ASC' },
  });
  const items = await AppDataSource.getRepository(CatalogItem).find({
    order: { key: 'ASC' },
  });

  return {
    sections: sections.map(({ key }) => ({ key })),
    items: items.map(({ key, sectionKey }) => ({ key, sectionKey })),
  };
};
