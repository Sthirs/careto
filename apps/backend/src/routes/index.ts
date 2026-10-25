import { Router } from 'express';

import { authRouter } from './authRoutes';
import { shoppingListRouter } from './shoppingListRoutes';
import { oauthRouter } from './oauthRoutes';
import { pushRouter } from './pushRoutes';
import { sessionRouter } from './sessionRoutes';

export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/auth/oauth', oauthRouter);
apiRouter.use('/auth/session', sessionRouter);
apiRouter.use('/lists', shoppingListRouter);
apiRouter.use('/push', pushRouter);
