import { NextFunction, Request, Response } from 'express';

import { isUuid } from '../utils/uuid';

// Every entity id is a Postgres `uuid` column. A path id that is not a UUID
// can never name an existing row, but handing it to TypeORM makes Postgres
// raise `invalid input syntax for type uuid`, which surfaced as a 500 HTML
// page or as a 400 echoing the raw database error. Rejecting it up front as
// a 404 matches how an unknown-but-well-formed id is already answered.
const NOT_FOUND_MESSAGES: Record<string, string> = {
  id: 'List not found.',
  dishId: 'Dish not found.',
  invitationId: 'Invitation not found.',
  itemId: 'Item not found.',
  userId: 'User is not a member of this list.',
};

/**
 * Mount after `requireAuth`, so an unauthenticated caller still gets a 401
 * rather than learning anything from the id's shape.
 */
export const requireUuidParams = (
  request: Request,
  response: Response,
  next: NextFunction,
): void => {
  for (const [name, value] of Object.entries(request.params)) {
    if (typeof value === 'string' && !isUuid(value)) {
      response
        .status(404)
        .json({ message: NOT_FOUND_MESSAGES[name] ?? 'Not found.' });
      return;
    }
  }

  next();
};
