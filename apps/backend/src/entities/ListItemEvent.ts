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
import { ListCustomItem } from './ListCustomItem';
import type { ListItemSource } from './ListItem';
import { ShoppingList } from './ShoppingList';
import { User } from './User';

export const LIST_ITEM_EVENT_KINDS = ['added', 'bought', 'unbought', 'removed'] as const;
export type ListItemEventKind = (typeof LIST_ITEM_EVENT_KINDS)[number];

/**
 * One thing that happened to an item of a list (ADR-0027): an add, a buy, the
 * undo of a mistaken buy, or a removal, with why the item was to buy. Rows
 * are only ever inserted; Learning derives each product's habit from them.
 * Keyed by the item's reference, not its row, because removing an item
 * deletes its `list_items` row while its history must stay.
 */
@Entity({ name: 'list_item_events' })
@Check(
  'CHK_list_item_events_one_reference',
  '("catalog_item_key" IS NULL) <> ("custom_item_id" IS NULL)',
)
@Index('IDX_list_item_events_catalog_item', ['shoppingListId', 'catalogItemKey', 'at'])
@Index('IDX_list_item_events_custom_item', ['shoppingListId', 'customItemId', 'at'])
export class ListItemEvent {
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

  @Column({ type: 'enum', enum: LIST_ITEM_EVENT_KINDS })
  kind!: ListItemEventKind;

  @Column({ type: 'enum', enum: ['user', 'dish', 'recurring'] })
  source!: ListItemSource;

  /** The member who acted; null when the system did (auto-fill). */
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user!: User | null;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId!: string | null;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  at!: Date;
}
