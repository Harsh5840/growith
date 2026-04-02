import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { createContainer } from './infrastructure/container';
import { createAuthRouter } from './gateway/routes/auth.routes';
import { createKycRouter } from './gateway/routes/kyc.routes';
import { createAdminAuthRouter } from './gateway/routes/admin-auth.routes';
import { createAdminRouter } from './gateway/routes/admin.routes';
import { createAdminKycRouter } from './gateway/routes/admin-kyc.routes';
import { errorHandler, notFoundHandler } from './gateway/middleware/error-handler.middleware';

export const createApp = () => {
  const app = express();
  const {
    authController,
    authenticate,
    kycController,
    adminAuthController,
    authenticateAdmin,
    adminKycController,
  } = createContainer();

  app.use(helmet());
  app.use(cors({ origin: '*' }));
  app.use(compression());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Investor routes
  app.use('/api/v1/investor/auth', createAuthRouter(authController, authenticate));
  app.use('/api/v1/investor/kyc', createKycRouter(kycController, authenticate));

  // Admin routes
  app.use('/api/v1/admin/auth', createAdminAuthRouter(adminAuthController, authenticateAdmin));
  app.use('/api/v1/admin', createAdminRouter(adminAuthController, authenticateAdmin));
  app.use('/api/v1/admin/kyc', createAdminKycRouter(adminKycController, authenticateAdmin));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
