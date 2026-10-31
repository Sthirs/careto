import type { EntityManager, Repository } from 'typeorm';

import { AppDataSource } from '../../db/data-source';
import { CatalogItem } from '../../entities/CatalogItem';
import { CatalogSection } from '../../entities/CatalogSection';
import { ListCustomItem } from '../../entities/ListCustomItem';
import { ListItem } from '../../entities/ListItem';
import { ListItemDish } from '../../entities/ListItemDish';
import { ListItemEvent } from '../../entities/ListItemEvent';
import { ListSectionOrder } from '../../entities/ListSectionOrder';
import {
  createShoppingListRepositories,
  type ShoppingListRepositories,
} from '../shoppingList/shoppingListRepositories';

/**
 * The list repositories (for the membership check) plus the item tables.
 * Resolved once per `ListItemService` instance, never at module load.
 */
export type ListItemRepositories = ShoppingListRepositories & {
  catalogItemRepository: Repository<CatalogItem>;
  catalogSectionRepository: Repository<CatalogSection>;
  customItemRepository: Repository<ListCustomItem>;
  listItemRepository: Repository<ListItem>;
  listItemDishRepository: Repository<ListItemDish>;
  listItemEventRepository: Repository<ListItemEvent>;
  sectionOrderRepository: Repository<ListSectionOrder>;
  /** Runs `work` on the section order table inside one transaction. */
  replaceSectionOrder: (
    work: (orders: Repository<ListSectionOrder>) => Promise<void>,
  ) => Promise<void>;
};

const ordersOf = (manager: Pick<EntityManager, 'getRepository'>) =>
  manager.getRepository(ListSectionOrder);

export function createListItemRepositories(): ListItemRepositories {
  return {
    ...createShoppingListRepositories(),
    catalogItemRepository: AppDataSource.getRepository(CatalogItem),
    catalogSectionRepository: AppDataSource.getRepository(CatalogSection),
    customItemRepository: AppDataSource.getRepository(ListCustomItem),
    listItemRepository: AppDataSource.getRepository(ListItem),
    listItemDishRepository: AppDataSource.getRepository(ListItemDish),
    listItemEventRepository: AppDataSource.getRepository(ListItemEvent),
    sectionOrderRepository: ordersOf(AppDataSource),
    replaceSectionOrder: (work) => AppDataSource.transaction((manager) => work(ordersOf(manager))),
  };
}
