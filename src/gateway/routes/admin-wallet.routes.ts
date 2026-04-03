import { RequestHandler, Router } from 'express';
import * as Joi from 'joi';
import { AdminWalletController } from '../controllers/admin/admin-wallet.controller';
import { HttpError } from '../../shared/errors/http-error';

const validate = (schema: Joi.ObjectSchema): RequestHandler => {
  return (req, _res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      allowUnknown: false,
      stripUnknown: true,
    });

    if (error) {
      return next(new HttpError(400, error.details[0]?.message || 'Validation failed'));
    }

    req.body = value;
    return next();
  };
};

const reviewPurchaseSchema = Joi.object({
  action: Joi.string().valid('APPROVE', 'REJECT').required(),
  reason: Joi.string().max(1000).optional().allow('', null),
  note: Joi.string().max(1000).optional().allow('', null),
});

export const createAdminWalletRouter = (
  adminWalletController: AdminWalletController,
  authenticateAdmin: RequestHandler,
) => {
  const router = Router();

  // GET   /admin/wallet/requests      → List all token purchase requests
  router.get('/requests', authenticateAdmin, adminWalletController.listPurchaseRequests);
  // GET   /admin/wallet/requests/:id  → Get one token purchase request
  router.get('/requests/:id', authenticateAdmin, adminWalletController.getPurchaseRequestById);
  // PATCH /admin/wallet/requests/:id/review → Approve/Reject request and credit tokens on approval
  router.patch(
    '/requests/:id/review',
    authenticateAdmin,
    validate(reviewPurchaseSchema),
    adminWalletController.reviewPurchaseRequest,
  );

  return router;
};
