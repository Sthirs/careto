import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { CatalogItem } from './CatalogItem';
import { CatalogSection } from './CatalogSection';
import { ListCustomItem } from './ListCustomItem';
import { ShoppingList } from './ShoppingList';

/**
 * The icon and store section a list chose for one item (ADR-0029): a default
 * catalog item or one of the list's custom items, never both. It applies
 * wherever the item shows in that list and outlives the item's list row.
 */
@Entity({ name: 'list_item_overrides' })
@Check(
  'CHK_list_item_overrides_one_reference',
  '("catalog_item_key" IS NULL) <> ("custom_item_id" IS NULL)',
)
@Index('UQ_list_item_overrides_list_catalog_item', ['shoppingListId', 'catalogItemKey'], {
  unique: true,
})
@Index('UQ_list_item_overrides_list_custom_item', ['shoppingListId', 'customItemId'], {
  unique: true,
})
export class ListItemOverride {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => ShoppingList, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'shopping_list_id' })
  shoppingList!: ShoppingList;

  @Column({ name: 'shopping_list_id', type: 'uuid' })
  shoppingListId!: string;

  @ManyToOne(() => CatalogItem, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'catalog_item_key' })
  catalogItem!: CatalogItem | null;

  @Column({ name: 'catalog_item_key', type: 'varchar', length: 60, nullable: true })
  catalogItemKey!: string | null;

  @ManyToOne(() => ListCustomItem, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'custom_item_id' })
  customItem!: ListCustomItem | null;

  @Column({ name: 'custom_item_id', type: 'uuid', nullable: true })
  customItemId!: string | null;

  /** A catalog item key whose icon replaces the item's own. */
  @Column({ name: 'icon_key', type: 'varchar', length: 60, nullable: true })
  iconKey!: string | null;

  /** A store section that replaces the item's own. */
  @ManyToOne(() => CatalogSection, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'section_key' })
  section!: CatalogSection | null;

  @Column({ name: 'section_key', type: 'varchar', length: 40, nullable: true })
  sectionKey!: string | null;
}
