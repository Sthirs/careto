import { Response } from 'express';

import { AuthedRequest, AuthenticatedRequest } from '../../middleware/auth';
import { getCatalog as loadCatalog } from '../../services/catalogService';
import { NotFoundError, postgresCodeOf, SupersededChangeError } from '../../services/domainErrors';
import { parseAddItemBody, parseItemUpdateBody } from './listItemBodies';
import { occurredAtOf } from './occurredAt';
import { listItemService } from './listItemServiceInstance';

/** A row the request refers to is gone (`foreign_key_violation`). */
const GONE_CODES = new Set(['23503']);
/** Input the database refuses every time: bad text, null, check, too long. */
const INVALID_CODES = new Set(['22P02', '23502', '23514', '22001']);

/**
 * Membership and lookup failures are 404s, like the rest of the list API; a
 * change overtaken by a later one is a 409 (ADR-0031). A database error that
 * would fail the same way on every retry is a 4xx too. Anything else is
 * unexpected, such as the database being down, and is a 500: the offline
 * outbox retries a 5xx but drops a 4xx (ADR-0030, ADR-0031).
 */
export const sendError = (response: Response, error: unknown, fallback: string) => {
  const code = postgresCodeOf(error);
  if (error instanceof NotFoundError || (code && GONE_CODES.has(code))) {
    response.status(404).json({ message: error instanceof NotFoundError ? error.message : 'Item not found.' });
    return;
  }
  if (code && INVALID_CODES.has(code)) {
    response.status(400).json({ message: fallback });
    return;
  }
  if (error instanceof SupersededChangeError) {
    response.status(409).json({ message: error.message });
    return;
  }
  console.error('[api] List item request failed', error);
  response.status(500).json({ message: fallback });
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
      occurredAtOf(request),
    );
    response.status(created ? 201 : 200).json({ item });
  } catch (error: unknown) {
    sendError(response, error, 'Unable to add item.');
  }
};

/** Changes the item's status, icon or store section (ADR-0026). */
export const updateItem = async (
  request: AuthenticatedRequest,
  response: Response,
): Promise<void> => {
  const { auth } = request as AuthedRequest;
  const parsed = parseItemUpdateBody(request.body);
  if (!parsed.ok) {
    response.status(400).json({ message: parsed.message });
    return;
  }

  const listId = request.params.id as string;
  const itemId = request.params.itemId as string;
  try {
    const update = parsed.value;
    const item =
      'status' in update
        ? await listItemService.setListItemStatus(
            listId,
            itemId,
            update.status,
            auth.userId,
            occurredAtOf(request),
          )
        : await listItemService.setListItemOverride(listId, itemId, update, auth.userId);
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
      occurredAtOf(request),
    );
    response.status(204).end();
  } catch (error: unknown) {
    sendError(response, error, 'Unable to remove item.');
  }
};
