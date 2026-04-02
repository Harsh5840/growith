import { RequestHandler, Router } from 'express';
import { AdminKycController } from '../controllers/admin/admin-kyc.controller';
import * as Joi from 'joi';
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

const rejectKycSchema = Joi.object({
  reason: Joi.string().min(3).max(1000).required(),
});

export const createAdminKycRouter = (
  adminKycController: AdminKycController,
  authenticateAdmin: RequestHandler,
) => {
  const router = Router();

  // GET   /admin/kyc              → List all KYC submissions
  router.get('/', authenticateAdmin, adminKycController.listKycSubmissions);
  // GET   /admin/kyc/:id          → Get single KYC + user data
  router.get('/:id', authenticateAdmin, adminKycController.getKycById);
  // PATCH /admin/kyc/:id/approve  → Approve KYC
  router.patch('/:id/approve', authenticateAdmin, adminKycController.approveKyc);
  // PATCH /admin/kyc/:id/reject   → Reject KYC with reason
  router.patch('/:id/reject', authenticateAdmin, validate(rejectKycSchema), adminKycController.rejectKyc);

  return router;
};
