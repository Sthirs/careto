import { Response } from 'express';

import { AuthedRequest, AuthenticatedRequest } from '../../middleware/auth';
import { getCatalog as loadCatalog } from '../../services/catalogService';
import { parseAddItemBody, parseStatusBody } from './listItemBodies';
import { listItemService } from './listItemServiceInstance';

/** Membership and lookup failures are 404s, like the rest of the list API. */
const sendError = (response: Response, error: unknown, fallback: string) => {
  const message = error instanceof Error ? error.message : fallback;
  response.status(message.includes('not found') ? 404 : 400).json({ message });
};

export const getCatalog = async (
  _request: AuthenticatedRequest,
  response: Response,
): Promise<void> => {
  response.json(await loadCatalog());
};

export const listItems = async (
  request: AuthenticatedRequest,
  response: Response,
): Promise<void> => {
  const { auth } = request as AuthedRequest;
  try {
    response.json(await listItemService.getListItems(request.params.id as string, auth.userId));
  } catch (error: unknown) {
    sendError(response, error, 'Unable to load items.');
  }
};

export const addItem = async (
  request: AuthenticatedRequest,
  response: Response,
): Promise<void> => {
  const { auth } = request as AuthedRequest;
  const parsed = parseAddItemBody(request.body);
  if (!parsed.ok) {
    response.status(400).json({ message: parsed.message });
    return;
  }

  try {
    const { item, created } = await listItemService.addListItem(
      request.params.id as string,
      parsed.value,
      auth.userId,
    );
    response.status(created ? 201 : 200).json({ item });
  } catch (error: unknown) {
    sendError(response, error, 'Unable to add item.');
  }
};

export const updateItemStatus = async (
  request: AuthenticatedRequest,
  response: Response,
): Promise<void> => {
  const { auth } = request as AuthedRequest;
  const parsed = parseStatusBody(request.body);
  if (!parsed.ok) {
    response.status(400).json({ message: parsed.message });
    return;
  }

  try {
    const item = await listItemService.setListItemStatus(
      request.params.id as string,
      request.params.itemId as string,
      parsed.value,
      auth.userId,
    );
    response.json({ item });
  } catch (error: unknown) {
    sendError(response, error, 'Unable to update item.');
  }
};

export const removeItem = async (
  request: AuthenticatedRequest,
  response: Response,
): Promise<void> => {
  const { auth } = request as AuthedRequest;
  try {
    await listItemService.removeListItem(
      request.params.id as string,
      request.params.itemId as string,
      auth.userId,
    );
    response.status(204).end();
  } catch (error: unknown) {
    sendError(response, error, 'Unable to remove item.');
  }
};
