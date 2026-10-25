import { Response } from 'express';

import { AuthedRequest, AuthenticatedRequest } from '../../middleware/auth';
import { isValidEmail } from '../../utils/emailValidation';
import { shoppingListService } from './shoppingListServiceInstance';

export const addMember = async (
  request: AuthenticatedRequest,
  response: Response,
): Promise<void> => {
  const { auth } = request as AuthedRequest;
  const shoppingListId = request.params.id as string;
  const { email } = request.body as { email?: unknown };

  if (!isValidEmail(email)) {
    response.status(400).json({ message: 'A valid email is required.' });
    return;
  }

  try {
    const invitation = await shoppingListService.addMemberByEmail(
      shoppingListId,
      email.trim().toLowerCase(),
      auth.userId,
    );

    response.status(201).json({ invitation });
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('not found')) {
      response.status(404).json({ message: error.message });
      return;
    }
    response.status(400).json({
      message: error instanceof Error ? error.message : 'Unable to add member.',
    });
  }
};

export const removeMember = async (
  request: AuthenticatedRequest,
  response: Response,
): Promise<void> => {
  const { auth } = request as AuthedRequest;
  const shoppingListId = request.params.id as string;
  const memberUserId = request.params.userId as string;

  try {
    await shoppingListService.removeMember(shoppingListId, memberUserId, auth.userId);

    response.status(204).send();
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('not found')) {
      response.status(404).json({ message: error.message });
      return;
    }
    if (error instanceof Error && error.message.includes('not a member')) {
      response.status(404).json({ message: error.message });
      return;
    }
    response.status(400).json({
      message:
        error instanceof Error ? error.message : 'Unable to remove member.',
    });
  }
};
