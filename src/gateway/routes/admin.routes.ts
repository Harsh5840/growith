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

  // GET    /admin/users      → List all investors
  router.get('/users', authenticateAdmin, adminAuthController.listUsers);
  // GET    /admin/users/:id  → Get investor by ID
  router.get('/users/:id', authenticateAdmin, adminAuthController.getUserById);
  // POST   /admin/users      → Create investor
  router.post('/users', authenticateAdmin, validate(adminCreateUserSchema), adminAuthController.createUser);
  // PATCH  /admin/users/:id  → Edit investor
  router.patch('/users/:id', authenticateAdmin, validate(adminEditUserSchema), adminAuthController.editUser);
  // DELETE /admin/users/:id  → Delete investor
  router.delete('/users/:id', authenticateAdmin, adminAuthController.deleteUser);

  return router;
};
