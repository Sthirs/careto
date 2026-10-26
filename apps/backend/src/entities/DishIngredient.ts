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
import { Dish } from './Dish';
import { ListCustomItem } from './ListCustomItem';

/**
 * One ingredient of a dish: a default catalog item or one of the list's
 * custom items, never both — the same references as `list_items`.
 */
@Entity({ name: 'dish_ingredients' })
@Check(
  'CHK_dish_ingredients_one_reference',
  '("catalog_item_key" IS NULL) <> ("custom_item_id" IS NULL)',
)
@Index('UQ_dish_ingredients_dish_catalog_item', ['dishId', 'catalogItemKey'], { unique: true })
@Index('UQ_dish_ingredients_dish_custom_item', ['dishId', 'customItemId'], { unique: true })
export class DishIngredient {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Dish, (dish) => dish.ingredients, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'dish_id' })
  dish!: Dish;

  @Column({ name: 'dish_id', type: 'uuid' })
  dishId!: string;

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

  @Column({ type: 'int' })
  position!: number;
}
