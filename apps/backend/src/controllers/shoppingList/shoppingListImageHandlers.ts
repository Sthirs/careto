import { Response } from 'express';

import { AuthedRequest, AuthenticatedRequest } from '../../middleware/auth';
import {
  normalizeToDataUrl,
  UnsupportedImageTypeError,
} from '../../services/imageService';
import { shoppingListService } from './shoppingListServiceInstance';

/**
 * POST /api/lists/:id/image — upload an image for the list.
 *
 * The multer middleware (uploadSingleImage) handles:
 *   - 413 Payload Too Large when file exceeds MAX_UPLOAD_BYTES
 *   - 415 Unsupported Media Type when MIME type is not in ALLOWED_MIME_TYPES
 *
 * This handler maps:
 *   - missing file → 400
 *   - sharp decode error → 422
 *   - UnsupportedImageTypeError (defense in depth) → 415
 */
export const updateShoppingListImage = async (
  request: AuthenticatedRequest,
  response: Response,
): Promise<void> => {
  const { auth } = request as AuthedRequest;
  const shoppingListId = request.params.id as string;

  if (!request.file) {
    response.status(400).json({ message: 'Image file is required.' });
    return;
  }

  try {
    const dataUrl = await normalizeToDataUrl(
      request.file.buffer,
      request.file.mimetype,
    );

    const shoppingList = await shoppingListService.updateShoppingListImage(
      shoppingListId,
      dataUrl,
      auth.userId,
    );
    response.json({ shoppingList });
  } catch (error: unknown) {
    if (error instanceof UnsupportedImageTypeError) {
      response.status(415).json({ message: error.message });
      return;
    }
    if (
      error instanceof Error &&
      error.name === 'Error' &&
      error.message.includes('Input buffer contains unsupported image format')
    ) {
      response.status(422).json({ message: 'Invalid image file.' });
      return;
    }
    if (error instanceof Error && error.message.includes('not found')) {
      response.status(404).json({ message: error.message });
      return;
    }
    response.status(400).json({
      message:
        error instanceof Error ? error.message : 'Unable to upload image.',
    });
  }
};
