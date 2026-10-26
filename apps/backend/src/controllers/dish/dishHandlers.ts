import { Response } from 'express';

import { AuthedRequest, AuthenticatedRequest } from '../../middleware/auth';
import { parseDishBody, parsePauseBody } from './dishBodies';
import { dishService } from './dishServiceInstance';

/** Membership and lookup failures are 404s, like the rest of the list API. */
export const sendDishError = (response: Response, error: unknown, fallback: string) => {
  const message = error instanceof Error ? error.message : fallback;
  response.status(message.includes('not found') ? 404 : 400).json({ message });
};

const ids = (request: AuthenticatedRequest) => ({
  listId: request.params.id as string,
  dishId: request.params.dishId as string,
  userId: (request as AuthedRequest).auth.userId,
});

export const listDishes = async (request: AuthenticatedRequest, response: Response) => {
  const { listId, userId } = ids(request);
  try {
    response.json({ dishes: await dishService.listDishes(listId, userId) });
  } catch (error: unknown) {
    sendDishError(response, error, 'Unable to load dishes.');
  }
};

export const getDish = async (request: AuthenticatedRequest, response: Response) => {
  const { listId, dishId, userId } = ids(request);
  try {
    response.json({ dish: await dishService.getDish(listId, dishId, userId) });
  } catch (error: unknown) {
    sendDishError(response, error, 'Unable to load dish.');
  }
};

export const createDish = async (request: AuthenticatedRequest, response: Response) => {
  const { listId, userId } = ids(request);
  const parsed = parseDishBody(request.body);
  if (!parsed.ok) {
    response.status(400).json({ message: parsed.message });
    return;
  }
  try {
    response.status(201).json({ dish: await dishService.createDish(listId, parsed.value, userId) });
  } catch (error: unknown) {
    sendDishError(response, error, 'Unable to create dish.');
  }
};

export const updateDish = async (request: AuthenticatedRequest, response: Response) => {
  const { listId, dishId, userId } = ids(request);
  const parsed = parseDishBody(request.body);
  if (!parsed.ok) {
    response.status(400).json({ message: parsed.message });
    return;
  }
  try {
    response.json({ dish: await dishService.updateDish(listId, dishId, parsed.value, userId) });
  } catch (error: unknown) {
    sendDishError(response, error, 'Unable to update dish.');
  }
};

export const updateDishPause = async (request: AuthenticatedRequest, response: Response) => {
  const { listId, dishId, userId } = ids(request);
  const parsed = parsePauseBody(request.body);
  if (!parsed.ok) {
    response.status(400).json({ message: parsed.message });
    return;
  }
  try {
    response.json({ dish: await dishService.setDishPause(listId, dishId, parsed.value, userId) });
  } catch (error: unknown) {
    sendDishError(response, error, 'Unable to update dish.');
  }
};

export const deleteDish = async (request: AuthenticatedRequest, response: Response) => {
  const { listId, dishId, userId } = ids(request);
  try {
    await dishService.deleteDish(listId, dishId, userId);
    response.status(204).end();
  } catch (error: unknown) {
    sendDishError(response, error, 'Unable to delete dish.');
  }
};

export const addDishToList = async (request: AuthenticatedRequest, response: Response) => {
  const { listId, dishId, userId } = ids(request);
  try {
    response.json({ dish: await dishService.addDishToList(listId, dishId, userId) });
  } catch (error: unknown) {
    sendDishError(response, error, 'Unable to add dish to the list.');
  }
};

export const removeDishFromList = async (request: AuthenticatedRequest, response: Response) => {
  const { listId, dishId, userId } = ids(request);
  try {
    response.json({ dish: await dishService.removeDishFromList(listId, dishId, userId) });
  } catch (error: unknown) {
    sendDishError(response, error, 'Unable to remove dish from the list.');
  }
};
