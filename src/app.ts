import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { createContainer } from './infrastructure/container';
import { createAuthRouter } from './gateway/routes/auth.routes';
import { createAdminAuthRouter } from './gateway/routes/admin-auth.routes';
import { errorHandler, notFoundHandler } from './gateway/middleware/error-handler.middleware';

export const createApp = () => {
  const app = express();
  const { authController, authenticate, adminAuthController, authenticateAdmin } = createContainer();

  app.use(helmet());
  app.use(cors({ origin: '*' }));
  app.use(compression());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.use('/api/v1/investor/auth', createAuthRouter(authController, authenticate));
  app.use('/api/v1/admin/auth', createAdminAuthRouter(adminAuthController, authenticateAdmin));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
