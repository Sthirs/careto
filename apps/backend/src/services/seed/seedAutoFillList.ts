import { AppDataSource } from '../../db/data-source';
import { ListItem, type ListItemSource } from '../../entities/ListItem';
import { ListItemEvent, type ListItemEventKind } from '../../entities/ListItemEvent';
import { ShoppingList } from '../../entities/ShoppingList';
import type { User } from '../../entities/User';
import { AUTO_FILL_SEED_LIST_NAME } from './seedData';

const DAY_MS = 24 * 60 * 60 * 1000;

type SeedEvent = [kind: ListItemEventKind, daysAgo: number];
type SeedProduct = { catalogItemKey: string; source: ListItemSource; events: SeedEvent[] };

/**
 * Two 7-day stock lifetimes each, with the last purchase 8 days ago: both
 * are due, so the first auto-fill run puts them back on the list.
 */
const handBought: SeedEvent[] = [
  ['added', 24],
  ['bought', 23],
  ['added', 16],
  ['bought', 15],
  ['added', 8.05],
  ['bought', 8],
];

const SEED_PRODUCTS: SeedProduct[] = [
  { catalogItemKey: 'milk', source: 'user', events: handBought },
  { catalogItemKey: 'bread', source: 'user', events: handBought },
  // Bought only for dishes: dish consumption never makes a product recurring.
  { catalogItemKey: 'mozzarella', source: 'dish', events: handBought },
];

/**
 * Rebuilds the demo user's auto-fill list on every seeded startup (ADR-0027),
 * with a back-dated history relative to now, so the auto-fill run that
 * follows the seed always has due products to add.
 */
export async function seedAutoFillList(demoUser: User): Promise<void> {
  const shoppingListRepository = AppDataSource.getRepository(ShoppingList);
  const existing = await shoppingListRepository.findOne({
    where: { name: AUTO_FILL_SEED_LIST_NAME, members: { id: demoUser.id } },
  });
  if (existing) await shoppingListRepository.remove(existing);

  const shoppingList = await shoppingListRepository.save(
    shoppingListRepository.create({
      name: AUTO_FILL_SEED_LIST_NAME,
      imageUrl: null,
      members: [demoUser],
    }),
  );

  const now = Date.now();
  const ago = (days: number) => new Date(now - days * DAY_MS);
  for (const product of SEED_PRODUCTS) {
    await AppDataSource.getRepository(ListItemEvent).insert(
      product.events.map(([kind, daysAgo]) => ({
        shoppingListId: shoppingList.id,
        catalogItemKey: product.catalogItemKey,
        kind,
        source: product.source,
        userId: demoUser.id,
        at: ago(daysAgo),
      })),
    );
    const lastBoughtDaysAgo = Math.min(
      ...product.events.filter(([kind]) => kind === 'bought').map(([, days]) => days),
    );
    await AppDataSource.getRepository(ListItem).insert({
      shoppingListId: shoppingList.id,
      catalogItemKey: product.catalogItemKey,
      status: 'bought',
      source: product.source,
      lastBoughtAt: ago(lastBoughtDaysAgo),
      addedById: demoUser.id,
    });
  }
}
