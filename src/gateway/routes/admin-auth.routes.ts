import { RequestHandler, Router } from 'express';
import { AdminAuthController } from '../controllers/admin/admin-auth.controller';
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

const adminRegisterSchema = Joi.object({
  email: Joi.string().email().required(),
  fullName: Joi.string().min(2).max(100).required(),
  password: Joi.string()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .required(),
  adminRegistrationSecret: Joi.string().optional(),
});

const adminLoginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const adminForgotPasswordSchema = Joi.object({
  email: Joi.string().email().required(),
});

const adminResetPasswordSchema = Joi.object({
  email: Joi.string().email().required(),
  code: Joi.string().length(6).required(),
  newPassword: Joi.string()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .required(),
  confirmPassword: Joi.any().valid(Joi.ref('newPassword')).required()
    .messages({ 'any.only': 'Passwords do not match' }),
});

export const createAdminAuthRouter = (
  adminAuthController: AdminAuthController, 
  authenticateAdmin: RequestHandler
) => {
  const router = Router();

  router.post('/register', validate(adminRegisterSchema), adminAuthController.register);
  router.post('/login', validate(adminLoginSchema), adminAuthController.login);
  router.post('/forgot-password', validate(adminForgotPasswordSchema), adminAuthController.forgotPassword);
  router.post('/reset-password', validate(adminResetPasswordSchema), adminAuthController.resetPassword);

  // Protected Auth Route (Require Admin Auth Token)
  router.get('/me', authenticateAdmin, adminAuthController.me);

  return router;
};
