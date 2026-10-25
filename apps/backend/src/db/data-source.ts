import 'reflect-metadata';

import { DataSource } from 'typeorm';

import { env } from '../config/env';
import { CatalogItem } from '../entities/CatalogItem';
import { CatalogSection } from '../entities/CatalogSection';
import { ListCustomItem } from '../entities/ListCustomItem';
import { ListItem } from '../entities/ListItem';
import { ListSectionOrder } from '../entities/ListSectionOrder';
import { ShoppingList } from '../entities/ShoppingList';
import { Invitation } from '../entities/Invitation';
import { PushSubscription } from '../entities/PushSubscription';
import { RefreshToken } from '../entities/RefreshToken';
import { User } from '../entities/User';
import { UserIdentity } from '../entities/UserIdentity';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: env.DATABASE_URL,
  synchronize: env.DB_SYNC,
  logging: false,
  entities: [
    User,
    UserIdentity,
    RefreshToken,
    ShoppingList,
    Invitation,
    PushSubscription,
    CatalogSection,
    CatalogItem,
    ListSectionOrder,
    ListCustomItem,
    ListItem,
  ],
});

export const initializeDatabase = async (): Promise<DataSource> => {
  if (AppDataSource.isInitialized) {
    return AppDataSource;
  }

  return AppDataSource.initialize();
};
