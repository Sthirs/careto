import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

import { Dish } from './Dish';
import { ListItem } from './ListItem';

/**
 * "This dish needs this list item" (ADR-0024). A link is open until the item
 * is bought; a dish with an open link to a to-buy item is "in the list".
 * Fulfilled links stay as the reason behind the purchase (spec §Learning).
 */
@Entity({ name: 'list_item_dishes' })
export class ListItemDish {
  @PrimaryColumn({ name: 'list_item_id', type: 'uuid' })
  listItemId!: string;

  @PrimaryColumn({ name: 'dish_id', type: 'uuid' })
  dishId!: string;

  @ManyToOne(() => ListItem, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'list_item_id' })
  listItem!: ListItem;

  @ManyToOne(() => Dish, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'dish_id' })
  dish!: Dish;

  @Column({ name: 'fulfilled_at', type: 'timestamptz', nullable: true })
  fulfilledAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
