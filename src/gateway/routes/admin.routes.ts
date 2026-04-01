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

const adminCreateUserSchema = Joi.object({
  email: Joi.string().email().required(),
  fullName: Joi.string().min(2).max(100).required(),
  password: Joi.string()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .optional(),
});

const adminEditUserSchema = Joi.object({
  fullName: Joi.string().min(2).max(100).optional(),
  isActive: Joi.boolean().optional(),
}).or('fullName', 'isActive');

export const createAdminRouter = (
  adminAuthController: AdminAuthController,
  authenticateAdmin: RequestHandler,
) => {
  const router = Router();

  router.get('/users', authenticateAdmin, adminAuthController.listUsers);
  router.get('/users/:id', authenticateAdmin, adminAuthController.getUserById);
  router.post('/users/create', authenticateAdmin, validate(adminCreateUserSchema), adminAuthController.createUser);
  router.patch('/users/:id/edit', authenticateAdmin, validate(adminEditUserSchema), adminAuthController.editUser);
  router.delete('/users/:id', authenticateAdmin, adminAuthController.deleteUser);

  return router;
};
