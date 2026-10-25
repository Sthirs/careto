import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { ShoppingList } from './ShoppingList';

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', unique: true })
  email!: string;

  @Column({ type: 'varchar', name: 'password_hash', nullable: true })
  passwordHash?: string | null;

  @Column({ type: 'varchar', name: 'display_name' })
  displayName!: string;

  @Column({ type: 'varchar', length: 8, default: 'en' })
  language!: string;

  @Column({ type: 'text', name: 'image_url', nullable: true })
  imageUrl!: string | null;

  @ManyToMany(() => ShoppingList, (shoppingList) => shoppingList.members)
  shoppingLists!: ShoppingList[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
