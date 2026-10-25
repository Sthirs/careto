import { getShoppingListForMember } from './shoppingListMembership';
import type { ShoppingListRepositories } from './shoppingListRepositories';
import {
  serializeShoppingList,
  serializePendingInvitation,
} from './shoppingListSerialization';

export async function createShoppingListForUser(
  repositories: ShoppingListRepositories,
  userId: string,
  name: string,
) {
  const user = await repositories.userRepository.findOne({
    where: { id: userId },
  });

  if (!user) {
    throw new Error('Authenticated user not found.');
  }

  const shoppingList = repositories.shoppingListRepository.create({
    name,
    members: [user],
  });

  const savedShoppingList = await repositories.shoppingListRepository.save(shoppingList);

  return serializeShoppingList(savedShoppingList);
}

export async function getShoppingListsForUser(
  repositories: ShoppingListRepositories,
  userId: string,
) {
  const shoppingLists = await repositories.shoppingListRepository
    .createQueryBuilder('shoppingList')
    .innerJoin('shoppingList.members', 'membership', 'membership.id = :userId', {
      userId,
    })
    .leftJoinAndSelect('shoppingList.members', 'member')
    .orderBy('shoppingList.createdAt', 'ASC')
    .getMany();

  return shoppingLists.map((shoppingList) => serializeShoppingList(shoppingList));
}

export async function getShoppingListByIdForUser(
  repositories: ShoppingListRepositories,
  shoppingListId: string,
  userId: string,
) {
  const shoppingList = await repositories.shoppingListRepository
    .createQueryBuilder('shoppingList')
    .innerJoin('shoppingList.members', 'membership', 'membership.id = :userId', {
      userId,
    })
    .leftJoinAndSelect('shoppingList.members', 'member')
    .where('shoppingList.id = :shoppingListId', { shoppingListId })
    .getOne();

  if (!shoppingList) {
    return null;
  }

  const pendingInvitations = await repositories.invitationRepository.find({
    where: { shoppingListId, status: 'pending' },
  });

  return {
    ...serializeShoppingList(shoppingList),
    pendingInvitations: pendingInvitations.map((invitation) =>
      serializePendingInvitation(invitation),
    ),
  };
}

export async function updateShoppingList(
  repositories: ShoppingListRepositories,
  shoppingListId: string,
  name: string,
  userId: string,
) {
  const shoppingList = await getShoppingListForMember(
    repositories,
    shoppingListId,
    userId,
  );

  shoppingList.name = name;
  const savedShoppingList = await repositories.shoppingListRepository.save(shoppingList);

  return serializeShoppingList(savedShoppingList);
}

export async function updateShoppingListImage(
  repositories: ShoppingListRepositories,
  shoppingListId: string,
  imageUrl: string,
  userId: string,
) {
  const shoppingList = await getShoppingListForMember(
    repositories,
    shoppingListId,
    userId,
  );

  shoppingList.imageUrl = imageUrl;
  const savedShoppingList = await repositories.shoppingListRepository.save(shoppingList);

  return serializeShoppingList(savedShoppingList);
}
