import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { CatalogItem } from './CatalogItem';
import { ListCustomItem } from './ListCustomItem';
import { ShoppingList } from './ShoppingList';
import { User } from './User';

export const LIST_ITEM_STATUSES = ['to_buy', 'bought'] as const;
export type ListItemStatus = (typeof LIST_ITEM_STATUSES)[number];

/** Where an item came from (spec §List). Only `user` is produced today. */
export type ListItemSource = 'user' | 'dish' | 'recurring';

/**
 * An item on a list: either a default catalog item or one of the list's
 * custom items, never both. Each item appears on a list at most once —
 * buying it flips `status`, adding it again flips it back.
 */
@Entity({ name: 'list_items' })
@Check(
  'CHK_list_items_one_reference',
  '("catalog_item_key" IS NULL) <> ("custom_item_id" IS NULL)',
)
@Index('UQ_list_items_list_catalog_item', ['shoppingListId', 'catalogItemKey'], {
  unique: true,
})
@Index('UQ_list_items_list_custom_item', ['shoppingListId', 'customItemId'], {
  unique: true,
})
export class ListItem {
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

  @Column({ type: 'enum', enum: LIST_ITEM_STATUSES, default: 'to_buy' })
  status!: ListItemStatus;

  @Column({ type: 'enum', enum: ['user', 'dish', 'recurring'], default: 'user' })
  source!: ListItemSource;

  @Column({ name: 'last_bought_at', type: 'timestamptz', nullable: true })
  lastBoughtAt!: Date | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'added_by_id' })
  addedBy!: User | null;

  @Column({ name: 'added_by_id', type: 'uuid', nullable: true })
  addedById!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
