export type WeekMeal = 'lunch' | 'dinner';

/** A planned meal: `weekday` is ISO, Monday = 1 (ADR-0025). */
export type WeekSlot = { weekday: number; meal: WeekMeal; dishId: string };
