import { AppDataSource } from '../../db/data-source';
import { ShoppingList } from '../../entities/ShoppingList';
import { User } from '../../entities/User';
import { hashPassword } from '../../utils/password';
import { seedAutoFillList } from './seedAutoFillList';
import { COMMON_PASSWORD, DEMO_EMAIL, SEED_SHOPPING_LISTS, SEED_USERS } from './seedData';

export const seedDatabase = async (): Promise<void> => {
  const userRepository = AppDataSource.getRepository(User);
  const shoppingListRepository = AppDataSource.getRepository(ShoppingList);

  // Demo user is the canonical seeded credential documented in the README.
  let demoUser = await userRepository.findOne({ where: { email: DEMO_EMAIL }, relations: { shoppingLists: true } });

  if (!demoUser) {
    demoUser = userRepository.create({
      email: DEMO_EMAIL,
      displayName: 'Demo User',
      passwordHash: await hashPassword(COMMON_PASSWORD),
    });

    demoUser = await userRepository.save(demoUser);
  }

  // Upsert the additional seed users idempotently.
  const usersByEmail = new Map<string, User>();
  usersByEmail.set(DEMO_EMAIL, demoUser);

  for (const seedUser of SEED_USERS) {
    const existing = await userRepository.findOne({ where: { email: seedUser.email } });

    if (existing) {
      usersByEmail.set(seedUser.email, existing);
      continue;
    }

    const created = userRepository.create({
      email: seedUser.email,
      displayName: seedUser.displayName,
      passwordHash: await hashPassword(COMMON_PASSWORD),
    });

    const saved = await userRepository.save(created);
    usersByEmail.set(seedUser.email, saved);
  }

  // Upsert each seed list idempotently, attaching every declared member.
  for (const seedShoppingList of SEED_SHOPPING_LISTS) {
    const existingShoppingList = await shoppingListRepository
      .createQueryBuilder('shoppingList')
      .leftJoinAndSelect('shoppingList.members', 'member')
      .where('shoppingList.name = :name', { name: seedShoppingList.name })
      .getOne();

    if (existingShoppingList) {
      // Ensure every declared member is present even if the list already
      // existed from a previous, smaller seed run.
      const missingMembers = seedShoppingList.memberEmails
        .map((email) => usersByEmail.get(email))
        .filter((user): user is User => user !== undefined)
        .filter((user) => !existingShoppingList.members.some((m) => m.id === user.id));

      if (missingMembers.length > 0) {
        existingShoppingList.members.push(...missingMembers);
        await shoppingListRepository.save(existingShoppingList);
      }

      continue;
    }

    const members = seedShoppingList.memberEmails
      .map((email) => usersByEmail.get(email))
      .filter((user): user is User => Boolean(user));

    const shoppingList = shoppingListRepository.create({
      name: seedShoppingList.name,
      imageUrl: null,
      members,
    });

    await shoppingListRepository.save(shoppingList);
  }

  await seedAutoFillList(demoUser);
};
