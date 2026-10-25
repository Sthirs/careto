import { Response } from 'express';

import { AuthedRequest, AuthenticatedRequest } from '../../middleware/auth';
import { invitationService } from '../../services/invitationService';
import { shoppingListService } from './shoppingListServiceInstance';

export const listShoppingLists = async (
  request: AuthenticatedRequest,
  response: Response,
): Promise<void> => {
  const { auth } = request as AuthedRequest;
  const shoppingLists = await shoppingListService.getShoppingListsForUser(auth.userId);
  const invitations = await invitationService.listPendingForInvitee(
    auth.userId,
  );

  response.json({ shoppingLists, invitations });
};

export const getShoppingList = async (
  request: AuthenticatedRequest,
  response: Response,
): Promise<void> => {
  const { auth } = request as AuthedRequest;
  const id = request.params.id as string;

  const shoppingList = await shoppingListService.getShoppingListByIdForUser(id, auth.userId);

  if (!shoppingList) {
    response.status(404).json({ message: 'List not found.' });
    return;
  }

  response.json({ shoppingList });
};

export const createShoppingList = async (
  request: AuthenticatedRequest,
  response: Response,
): Promise<void> => {
  const { auth } = request as AuthedRequest;
  const { name } = request.body as { name?: unknown };

  if (typeof name !== 'string' || name.trim().length === 0) {
    response.status(400).json({ message: 'List name is required.' });
    return;
  }

  try {
    const shoppingList = await shoppingListService.createShoppingListForUser(
      auth.userId,
      name.trim(),
    );

    response.status(201).json({ shoppingList });
  } catch (error: unknown) {
    response.status(400).json({
      message:
        error instanceof Error ? error.message : 'Unable to create list.',
    });
  }
};

export const updateShoppingList = async (
  request: AuthenticatedRequest,
  response: Response,
): Promise<void> => {
  const { auth } = request as AuthedRequest;
  const shoppingListId = request.params.id as string;
  const { name } = request.body as { name?: unknown };

  if (typeof name !== 'string' || name.trim().length === 0) {
    response.status(400).json({ message: 'List name is required.' });
    return;
  }

  try {
    const shoppingList = await shoppingListService.updateShoppingList(
      shoppingListId,
      name.trim(),
      auth.userId,
    );

    response.json({ shoppingList });
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('not found')) {
      response.status(404).json({ message: error.message });
      return;
    }
    response.status(400).json({
      message:
        error instanceof Error ? error.message : 'Unable to update list.',
    });
  }
};
