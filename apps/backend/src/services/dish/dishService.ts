import * as dishListing from './dishListing';
import * as dishMutations from './dishMutations';
import * as dishQueries from './dishQueries';
import { createDishRepositories, type DishRepositories } from './dishRepositories';

/** Facade over the dish modules, mirroring `ListItemService`. */
export class DishService {
  private repositories: DishRepositories = createDishRepositories();

  async listDishes(shoppingListId: string, userId: string) {
    return dishQueries.listDishes(this.repositories, shoppingListId, userId);
  }

  async getDish(shoppingListId: string, dishId: string, userId: string) {
    return dishQueries.getDish(this.repositories, shoppingListId, dishId, userId);
  }

  async createDish(shoppingListId: string, input: dishMutations.DishInput, userId: string) {
    return dishMutations.createDish(this.repositories, shoppingListId, input, userId);
  }

  async updateDish(
    shoppingListId: string,
    dishId: string,
    input: dishMutations.DishInput,
    userId: string,
  ) {
    return dishMutations.updateDish(this.repositories, shoppingListId, dishId, input, userId);
  }

  async setDishPause(
    shoppingListId: string,
    dishId: string,
    pausedUntil: string | null,
    userId: string,
  ) {
    return dishMutations.setDishPause(this.repositories, shoppingListId, dishId, pausedUntil, userId);
  }

  async setDishImage(shoppingListId: string, dishId: string, imageUrl: string, userId: string) {
    return dishMutations.setDishImage(this.repositories, shoppingListId, dishId, imageUrl, userId);
  }

  async deleteDish(shoppingListId: string, dishId: string, userId: string) {
    return dishMutations.deleteDish(this.repositories, shoppingListId, dishId, userId);
  }

  async addDishToList(shoppingListId: string, dishId: string, userId: string) {
    return dishListing.addDishToList(this.repositories, shoppingListId, dishId, userId);
  }

  async removeDishFromList(shoppingListId: string, dishId: string, userId: string) {
    return dishListing.removeDishFromList(this.repositories, shoppingListId, dishId, userId);
  }
}
