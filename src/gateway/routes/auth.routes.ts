import { RequestHandler, Router } from 'express';
import { AuthController } from '../controllers/investor/auth.controller';
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

const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  fullName: Joi.string().min(2).max(100).required(),
  password: Joi.string()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .required(),
  confirmPassword: Joi.string().valid(Joi.ref('password')).required(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const googleSchema = Joi.object({ code: Joi.string().required() });

const validateEmailSchema = Joi.object({
  email: Joi.string().email().required(),
  mode: Joi.string().valid('signup', 'signin').required(),
  password: Joi.string().optional(),
});

const refreshSchema = Joi.object({ refreshToken: Joi.string().required() });

const forgotPasswordSchema = Joi.object({ email: Joi.string().email().required() });

const resetPasswordSchema = Joi.object({
  token: Joi.string().required(),
  newPassword: Joi.string()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .required(),
  confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required(),
});

export const createAuthRouter = (authController: AuthController, authenticate: RequestHandler) => {
  const router = Router();

  router.post('/register', validate(registerSchema), authController.register);
  router.post('/validate-email', validate(validateEmailSchema), authController.validateEmail);
  router.post('/login', validate(loginSchema), authController.login);
  router.get('/google/url', authController.getGoogleAuthUrl);
  router.get('/google/callback', authController.googleCallback);
  router.post('/google', validate(googleSchema), authController.googleAuth);
  router.post('/refresh-token', validate(refreshSchema), authController.refreshToken);
  router.post('/forgot-password', validate(forgotPasswordSchema), authController.forgotPassword);
  router.post('/reset-password', validate(resetPasswordSchema), authController.resetPassword);
  router.post('/logout', authenticate, authController.logout);
  router.get('/me', authenticate, authController.me);

  return router;
};
