import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { ShoppingList } from './ShoppingList';
import { User } from './User';

export const CUSTOM_ITEM_NAME_MAX_LENGTH = 60;

/** An item a member made up for one list; it exists only in that list. */
@Entity({ name: 'list_custom_items' })
@Index('UQ_list_custom_items_list_name', ['shoppingListId', 'normalizedName'], {
  unique: true,
})
export class ListCustomItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => ShoppingList, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'shopping_list_id' })
  shoppingList!: ShoppingList;

  @Column({ name: 'shopping_list_id', type: 'uuid' })
  shoppingListId!: string;

  @Column({ type: 'varchar', length: CUSTOM_ITEM_NAME_MAX_LENGTH })
  name!: string;

  /** Trimmed, lower-cased `name`: a list cannot hold the same custom item twice. */
  @Column({
    name: 'normalized_name',
    type: 'varchar',
    length: CUSTOM_ITEM_NAME_MAX_LENGTH,
  })
  normalizedName!: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by_id' })
  createdBy!: User | null;

  @Column({ name: 'created_by_id', type: 'uuid', nullable: true })
  createdById!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
