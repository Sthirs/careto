import type { Repository } from 'typeorm';

import { AppDataSource } from '../../db/data-source';
import { ShoppingList } from '../../entities/ShoppingList';
import { Invitation } from '../../entities/Invitation';
import { User } from '../../entities/User';

/**
 * The set of TypeORM repositories the list service modules operate on.
 * They are resolved once per `ShoppingListService` instance (not at module load)
 * so the data source is only touched when a service is constructed.
 */
export type ShoppingListRepositories = {
  shoppingListRepository: Repository<ShoppingList>;
  userRepository: Repository<User>;
  invitationRepository: Repository<Invitation>;
};

export function createShoppingListRepositories(): ShoppingListRepositories {
  return {
    shoppingListRepository: AppDataSource.getRepository(ShoppingList),
    userRepository: AppDataSource.getRepository(User),
    invitationRepository: AppDataSource.getRepository(Invitation),
  };
}
