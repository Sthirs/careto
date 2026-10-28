import { Response } from 'express';

import { AuthedRequest, AuthenticatedRequest } from '../../middleware/auth';
import { WeekPlanService } from '../../services/weekPlanService';
import { sendDishError } from '../dish/dishHandlers';
import { parsePlanBody, parseSlotBody } from './weekPlanBodies';

const weekPlanService = new WeekPlanService();

const ids = (request: AuthenticatedRequest) => ({
  listId: request.params.id as string,
  userId: (request as AuthedRequest).auth.userId,
});

export const getWeekPlan = async (request: AuthenticatedRequest, response: Response) => {
  const { listId, userId } = ids(request);
  try {
    response.json(await weekPlanService.getPlan(listId, userId));
  } catch (error: unknown) {
    sendDishError(response, error, 'Unable to load the week plan.');
  }
};

export const setWeekSlot = async (request: AuthenticatedRequest, response: Response) => {
  const { listId, userId } = ids(request);
  const parsed = parseSlotBody(request.body);
  if (!parsed.ok) {
    response.status(400).json({ message: parsed.message });
    return;
  }
  try {
    response.json(await weekPlanService.setSlot(listId, parsed.value, userId));
  } catch (error: unknown) {
    sendDishError(response, error, 'Unable to update the week plan.');
  }
};

export const replaceWeekPlan = async (request: AuthenticatedRequest, response: Response) => {
  const { listId, userId } = ids(request);
  const parsed = parsePlanBody(request.body);
  if (!parsed.ok) {
    response.status(400).json({ message: parsed.message });
    return;
  }
  try {
    response.json(await weekPlanService.replacePlan(listId, parsed.value, userId));
  } catch (error: unknown) {
    sendDishError(response, error, 'Unable to update the week plan.');
  }
};

export const addWeekPlanToList = async (request: AuthenticatedRequest, response: Response) => {
  const { listId, userId } = ids(request);
  try {
    await weekPlanService.addPlanToList(listId, userId);
    response.status(204).end();
  } catch (error: unknown) {
    sendDishError(response, error, 'Unable to add the week plan to the list.');
  }
};
