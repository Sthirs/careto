import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * A store section of the default item catalog. Reference data synced from
 * `services/catalog/catalogData.ts` on every start; the label lives in the
 * frontend i18n catalogs under the same key (ADR-0014).
 */
@Entity({ name: 'catalog_sections' })
export class CatalogSection {
  @PrimaryColumn({ type: 'varchar', length: 40 })
  key!: string;

  /** Default order, used by lists that never reordered their sections. */
  @Column({ type: 'int' })
  position!: number;
}
