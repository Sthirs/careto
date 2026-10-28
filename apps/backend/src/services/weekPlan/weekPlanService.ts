import type { WeekMeal } from '../../entities/WeekSlot';
import * as operations from './weekPlanOperations';
import { createWeekPlanRepositories, type WeekPlanRepositories } from './weekPlanRepositories';

/** Facade over the week plan operations, mirroring `DishService`. */
export class WeekPlanService {
  private repositories: WeekPlanRepositories = createWeekPlanRepositories();

  async getPlan(shoppingListId: string, userId: string) {
    return operations.getPlan(this.repositories, shoppingListId, userId);
  }

  async setSlot(
    shoppingListId: string,
    slot: { weekday: number; meal: WeekMeal; dishId: string | null },
    userId: string,
  ) {
    return operations.setSlot(this.repositories, shoppingListId, slot, userId);
  }

  async replacePlan(shoppingListId: string, slots: operations.WeekSlotInput[], userId: string) {
    return operations.replacePlan(this.repositories, shoppingListId, slots, userId);
  }

  async addPlanToList(shoppingListId: string, userId: string) {
    return operations.addPlanToList(this.repositories, shoppingListId, userId);
  }
}
