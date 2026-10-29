import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { Dish } from './Dish';
import { ShoppingList } from './ShoppingList';

export const WEEK_MEALS = ['lunch', 'dinner'] as const;
export type WeekMeal = (typeof WEEK_MEALS)[number];

/**
 * One planned meal of a list's rolling week plan (ADR-0025): a dish for a
 * weekday (ISO, Monday = 1) and meal. An empty slot has no row.
 */
@Entity({ name: 'week_slots' })
@Unique('UQ_week_slots_slot', ['shoppingListId', 'weekday', 'meal'])
export class WeekSlot {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => ShoppingList, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'shopping_list_id' })
  shoppingList!: ShoppingList;

  @Column({ name: 'shopping_list_id', type: 'uuid' })
  shoppingListId!: string;

  @Column({ type: 'smallint' })
  weekday!: number;

  @Column({ type: 'enum', enum: WEEK_MEALS })
  meal!: WeekMeal;

  @ManyToOne(() => Dish, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'dish_id' })
  dish!: Dish;

  @Column({ name: 'dish_id', type: 'uuid' })
  dishId!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
