import * as shoppingListCrud from './shoppingListCrud';
import * as shoppingListMembership from './shoppingListMembership';
import {
  createShoppingListRepositories,
  type ShoppingListRepositories,
} from './shoppingListRepositories';

/**
 * Facade over the list domain modules. The public method surface is the
 * contract consumed by `shoppingListController.ts` (a module-level singleton) and
 * spied on via `ShoppingListService.prototype` in the controller tests, so every
 * method must stay a prototype method with an unchanged signature.
 */
export class ShoppingListService {
  private repositories: ShoppingListRepositories = createShoppingListRepositories();

  async createShoppingListForUser(userId: string, name: string) {
    return shoppingListCrud.createShoppingListForUser(this.repositories, userId, name);
  }

  async getShoppingListsForUser(userId: string) {
    return shoppingListCrud.getShoppingListsForUser(this.repositories, userId);
  }

  async getShoppingListByIdForUser(shoppingListId: string, userId: string) {
    return shoppingListCrud.getShoppingListByIdForUser(this.repositories, shoppingListId, userId);
  }

  async updateShoppingList(shoppingListId: string, name: string, userId: string) {
    return shoppingListCrud.updateShoppingList(this.repositories, shoppingListId, name, userId);
  }

  async updateShoppingListImage(shoppingListId: string, imageUrl: string, userId: string) {
    return shoppingListCrud.updateShoppingListImage(
      this.repositories,
      shoppingListId,
      imageUrl,
      userId,
    );
  }

  async addMemberByEmail(shoppingListId: string, email: string, userId: string) {
    return shoppingListMembership.addMemberByEmail(
      this.repositories,
      shoppingListId,
      email,
      userId,
    );
  }

  async removeMember(shoppingListId: string, memberUserId: string, userId: string) {
    return shoppingListMembership.removeMember(
      this.repositories,
      shoppingListId,
      memberUserId,
      userId,
    );
  }
}
