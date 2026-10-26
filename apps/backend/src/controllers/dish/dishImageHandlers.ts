import { Response } from 'express';

import { AuthedRequest, AuthenticatedRequest } from '../../middleware/auth';
import { normalizeToDataUrl, UnsupportedImageTypeError } from '../../services/imageService';
import { sendDishError } from './dishHandlers';
import { dishService } from './dishServiceInstance';

/**
 * POST /api/lists/:id/dishes/:dishId/image — same pipeline and status codes
 * as the list image (ADR-0015): missing file 400, undecodable 422, wrong type 415.
 */
export const updateDishImage = async (request: AuthenticatedRequest, response: Response) => {
  const { auth } = request as AuthedRequest;
  if (!request.file) {
    response.status(400).json({ message: 'Image file is required.' });
    return;
  }

  try {
    const dataUrl = await normalizeToDataUrl(request.file.buffer, request.file.mimetype);
    const dish = await dishService.setDishImage(
      request.params.id as string,
      request.params.dishId as string,
      dataUrl,
      auth.userId,
    );
    response.json({ dish });
  } catch (error: unknown) {
    if (error instanceof UnsupportedImageTypeError) {
      response.status(415).json({ message: error.message });
      return;
    }
    if (
      error instanceof Error &&
      error.message.includes('Input buffer contains unsupported image format')
    ) {
      response.status(422).json({ message: 'Invalid image file.' });
      return;
    }
    sendDishError(response, error, 'Unable to upload image.');
  }
};
