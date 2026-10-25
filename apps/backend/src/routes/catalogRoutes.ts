import { Router } from 'express';

import { getCatalog } from '../controllers/listItemController';
import { requireAuth } from '../middleware/auth';

export const catalogRouter = Router();

catalogRouter.get('/', requireAuth, getCatalog);
