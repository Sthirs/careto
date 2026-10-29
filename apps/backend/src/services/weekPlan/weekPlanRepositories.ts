import type { EntityManager, Repository } from 'typeorm';

import { AppDataSource } from '../../db/data-source';
import { WeekSlot } from '../../entities/WeekSlot';
import { createDishRepositories, type DishRepositories } from '../dish/dishRepositories';

/**
 * The dish repositories (membership, dishes, and what adding a dish touches)
 * plus the week slots. `replaceSlots` swaps a list's whole plan in one
 * transaction.
 */
export type WeekPlanRepositories = DishRepositories & {
  weekSlotRepository: Repository<WeekSlot>;
  replaceSlots: (work: (slots: Repository<WeekSlot>) => Promise<void>) => Promise<void>;
};

const slotsOf = (manager: Pick<EntityManager, 'getRepository'>) => manager.getRepository(WeekSlot);

export function createWeekPlanRepositories(): WeekPlanRepositories {
  return {
    ...createDishRepositories(),
    weekSlotRepository: slotsOf(AppDataSource),
    replaceSlots: (work) => AppDataSource.transaction((manager) => work(slotsOf(manager))),
  };
}
