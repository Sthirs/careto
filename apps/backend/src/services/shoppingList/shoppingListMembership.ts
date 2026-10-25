import { ShoppingList } from '../../entities/ShoppingList';
import { invitationService } from '../invitationService';
import type { ShoppingListRepositories } from './shoppingListRepositories';

/**
 * Verifies the user is a member of the list and returns the list entity.
 * Throws if not found or user is not a member.
 */
export async function getShoppingListForMember(
  repositories: ShoppingListRepositories,
  shoppingListId: string,
  userId: string,
): Promise<ShoppingList> {
  const shoppingList = await repositories.shoppingListRepository
    .createQueryBuilder('shoppingList')
    .innerJoin('shoppingList.members', 'membership', 'membership.id = :userId', {
      userId,
    })
    .leftJoinAndSelect('shoppingList.members', 'member')
    .where('shoppingList.id = :shoppingListId', { shoppingListId })
    .getOne();

  if (!shoppingList) {
    throw new Error('List not found or you are not a member.');
  }

  return shoppingList;
}

export async function addMemberByEmail(
  repositories: ShoppingListRepositories,
  shoppingListId: string,
  email: string,
  userId: string,
) {
  const shoppingList = await getShoppingListForMember(
    repositories,
    shoppingListId,
    userId,
  );

  const normalizedEmail = email.trim().toLowerCase();
  const alreadyMember = shoppingList.members.some(
    (member) => member.email === normalizedEmail,
  );
  if (alreadyMember) {
    throw new Error('User is already a member of this list.');
  }

  return invitationService.createInvitation(shoppingListId, normalizedEmail, userId);
}

export async function removeMember(
  repositories: ShoppingListRepositories,
  shoppingListId: string,
  memberUserId: string,
  userId: string,
) {
  const shoppingList = await getShoppingListForMember(
    repositories,
    shoppingListId,
    userId,
  );

  const memberIndex = shoppingList.members.findIndex((m) => m.id === memberUserId);
  if (memberIndex === -1) {
    throw new Error('User is not a member of this list.');
  }

  shoppingList.members.splice(memberIndex, 1);
  await repositories.shoppingListRepository.save(shoppingList);
}
