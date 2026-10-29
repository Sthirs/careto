import { Response } from 'express';

import { AuthedRequest, AuthenticatedRequest } from '../../middleware/auth';
import { parseSectionOrderBody } from './listItemBodies';
import { sendError } from './listItemHandlers';
import { listItemService } from './listItemServiceInstance';

export const getSectionOrder = async (
  request: AuthenticatedRequest,
  response: Response,
): Promise<void> => {
  const { auth } = request as AuthedRequest;
  try {
    response.json(await listItemService.getSectionOrder(request.params.id as string, auth.userId));
  } catch (error: unknown) {
    sendError(response, error, 'Unable to load the section order.');
  }
};

export const replaceSectionOrder = async (
  request: AuthenticatedRequest,
  response: Response,
): Promise<void> => {
  const { auth } = request as AuthedRequest;
  const parsed = parseSectionOrderBody(request.body);
  if (!parsed.ok) {
    response.status(400).json({ message: parsed.message });
    return;
  }

  try {
    response.json(
      await listItemService.replaceSectionOrder(
        request.params.id as string,
        parsed.value,
        auth.userId,
      ),
    );
  } catch (error: unknown) {
    sendError(response, error, 'Unable to save the section order.');
  }
};

export const resetSectionOrder = async (
  request: AuthenticatedRequest,
  response: Response,
): Promise<void> => {
  const { auth } = request as AuthedRequest;
  try {
    response.json(
      await listItemService.resetSectionOrder(request.params.id as string, auth.userId),
    );
  } catch (error: unknown) {
    sendError(response, error, 'Unable to reset the section order.');
  }
};
