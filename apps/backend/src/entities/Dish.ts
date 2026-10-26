import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { DishIngredient } from './DishIngredient';
import { ShoppingList } from './ShoppingList';
import { User } from './User';

export const DISH_NAME_MAX_LENGTH = 80;

/**
 * A dish of one list (spec §Dishes). Whether it is "in the list" is derived
 * from its open `list_item_dishes` links, never stored here (ADR-0024).
 */
@Entity({ name: 'dishes' })
export class Dish {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => ShoppingList, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'shopping_list_id' })
  shoppingList!: ShoppingList;

  @Column({ name: 'shopping_list_id', type: 'uuid' })
  shoppingListId!: string;

  @Column({ type: 'varchar', length: DISH_NAME_MAX_LENGTH })
  name!: string;

  /** A `data:image/webp;base64,…` URL, as for list images (ADR-0015). */
  @Column({ name: 'image_url', type: 'text', nullable: true })
  imageUrl!: string | null;

  /** `YYYY-MM-DD`; the dish is paused while this date is after today. */
  @Column({ name: 'paused_until', type: 'date', nullable: true })
  pausedUntil!: string | null;

  @Column({ name: 'last_added_at', type: 'timestamptz', nullable: true })
  lastAddedAt!: Date | null;

  /** `lastAddedAt` before the latest add, restored when that add is undone. */
  @Column({ name: 'previous_last_added_at', type: 'timestamptz', nullable: true })
  previousLastAddedAt!: Date | null;

  @OneToMany(() => DishIngredient, (ingredient) => ingredient.dish)
  ingredients!: DishIngredient[];

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
