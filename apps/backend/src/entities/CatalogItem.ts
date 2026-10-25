import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

import { CatalogSection } from './CatalogSection';

/**
 * A default item every list can use. Reference data keyed by a stable slug;
 * items inside a section are ordered alphabetically by their localized label
 * on the client, so there is no position column.
 */
@Entity({ name: 'catalog_items' })
export class CatalogItem {
  @PrimaryColumn({ type: 'varchar', length: 60 })
  key!: string;

  @ManyToOne(() => CatalogSection, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'section_key' })
  section!: CatalogSection;

  @Column({ name: 'section_key', type: 'varchar', length: 40 })
  sectionKey!: string;
}
