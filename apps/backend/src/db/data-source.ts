import 'reflect-metadata';

import { DataSource } from 'typeorm';

import { env } from '../config/env';
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
  ],
});

export const initializeDatabase = async (): Promise<DataSource> => {
  if (AppDataSource.isInitialized) {
    return AppDataSource;
  }

  return AppDataSource.initialize();
};
