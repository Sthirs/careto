import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

import { CatalogSection } from './CatalogSection';
import { ShoppingList } from './ShoppingList';

/**
 * A list's own position for a store section. A list without rows here uses
 * the default `catalog_sections.position` order.
 */
@Entity({ name: 'list_section_orders' })
export class ListSectionOrder {
  @PrimaryColumn({ name: 'shopping_list_id', type: 'uuid' })
  shoppingListId!: string;

  @PrimaryColumn({ name: 'section_key', type: 'varchar', length: 40 })
  sectionKey!: string;

  @ManyToOne(() => ShoppingList, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'shopping_list_id' })
  shoppingList!: ShoppingList;

  @ManyToOne(() => CatalogSection, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'section_key' })
  section!: CatalogSection;

  @Column({ type: 'int' })
  position!: number;
}
