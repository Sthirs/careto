import type { EntityManager, Repository } from 'typeorm';

import { AppDataSource } from '../../db/data-source';
import { Dish } from '../../entities/Dish';
import { DishIngredient } from '../../entities/DishIngredient';
import {
  createListItemRepositories,
  type ListItemRepositories,
} from '../listItem/listItemRepositories';

/** The dish tables bound to one entity manager, so they can join a transaction. */
export type DishTables = {
  dishRepository: Repository<Dish>;
  dishIngredientRepository: Repository<DishIngredient>;
};

/**
 * The list-item repositories (membership check, items, links) plus the dish
 * tables. `transaction` runs `work` with the dish tables of one transaction.
 */
export type DishRepositories = ListItemRepositories &
  DishTables & {
    transaction: <T>(work: (tables: DishTables) => Promise<T>) => Promise<T>;
  };

const dishTables = (manager: Pick<EntityManager, 'getRepository'>): DishTables => ({
  dishRepository: manager.getRepository(Dish),
  dishIngredientRepository: manager.getRepository(DishIngredient),
});

export function createDishRepositories(): DishRepositories {
  return {
    ...createListItemRepositories(),
    ...dishTables(AppDataSource),
    transaction: (work) => AppDataSource.transaction((manager) => work(dishTables(manager))),
  };
}
