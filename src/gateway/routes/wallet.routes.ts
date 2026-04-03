import { RequestHandler, Router } from 'express';
import multer from 'multer';
import * as Joi from 'joi';
import { WalletController } from '../controllers/investor/wallet.controller';
import { HttpError } from '../../shared/errors/http-error';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPG, PNG, and PDF are allowed.'));
    }
  },
});

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

const createPurchaseRequestSchema = Joi.object({
  tokenCount: Joi.number().integer().min(1).required(),
});

export const createWalletRouter = (walletController: WalletController, authenticate: RequestHandler) => {
  const router = Router();

  // GET  /investor/wallet           → Wallet summary + marketplace access
  router.get('/', authenticate, walletController.getWalletOverview);
  // GET  /investor/wallet/requests  → My token purchase requests
  router.get('/requests', authenticate, walletController.listMyPurchaseRequests);
  // POST /investor/wallet/requests  → Create token purchase request with payment proof
  router.post(
    '/requests',
    authenticate,
    upload.single('paymentProof'),
    validate(createPurchaseRequestSchema),
    walletController.createPurchaseRequest,
  );

  return router;
};
