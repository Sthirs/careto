import type { Repository } from 'typeorm';

import { AppDataSource } from '../../db/data-source';
import { CatalogItem } from '../../entities/CatalogItem';
import { CatalogSection } from '../../entities/CatalogSection';
import { ListCustomItem } from '../../entities/ListCustomItem';
import { ListItem } from '../../entities/ListItem';
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
  sectionOrderRepository: Repository<ListSectionOrder>;
};

export function createListItemRepositories(): ListItemRepositories {
  return {
    ...createShoppingListRepositories(),
    catalogItemRepository: AppDataSource.getRepository(CatalogItem),
    catalogSectionRepository: AppDataSource.getRepository(CatalogSection),
    customItemRepository: AppDataSource.getRepository(ListCustomItem),
    listItemRepository: AppDataSource.getRepository(ListItem),
    sectionOrderRepository: AppDataSource.getRepository(ListSectionOrder),
  };
}
