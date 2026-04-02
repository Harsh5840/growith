import { RequestHandler, Router } from 'express';
import { KycController } from '../controllers/investor/kyc.controller';
import multer from 'multer';
import * as Joi from 'joi';
import { HttpError } from '../../shared/errors/http-error';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB max
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

const kycUploadFields = upload.fields([
  { name: 'aadhaarFront', maxCount: 1 },
  { name: 'aadhaarBack', maxCount: 1 },
  { name: 'panFront', maxCount: 1 },
  { name: 'supportingDoc', maxCount: 1 },
]);

const validateKycBody: RequestHandler = (req, _res, next) => {
  const schema = Joi.object({
    fullLegalName: Joi.string().min(2).max(200).required(),
    dateOfBirth: Joi.string().required(),
    nationality: Joi.string().min(2).max(100).required(),
    countryOfResidence: Joi.string().min(2).max(100).required(),
    city: Joi.string().min(1).max(100).required(),
    stateProvince: Joi.string().min(1).max(100).required(),
    phoneNumber: Joi.string().min(5).max(20).required(),
    streetAddress: Joi.string().min(5).max(500).required(),
    aadhaarNumber: Joi.string().pattern(/^\d{12}$/).required().messages({
      'string.pattern.base': 'Aadhaar number must be exactly 12 digits',
    }),
    panNumber: Joi.string().pattern(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/).required().messages({
      'string.pattern.base': 'PAN number must be in format ABCDE1234F',
    }),
    termsAgreed: Joi.any().required(),
    supportingDocName: Joi.string().max(200).optional().allow('', null),
  });

  const { error, value } = schema.validate(req.body, {
    abortEarly: false,
    allowUnknown: true,
    stripUnknown: false,
  });

  if (error) {
    return next(new HttpError(400, error.details[0]?.message || 'Validation failed'));
  }

  req.body = { ...req.body, ...value };
  return next();
};

export const createKycRouter = (kycController: KycController, authenticate: RequestHandler) => {
  const router = Router();

  // POST /investor/kyc         → Submit KYC application (multipart form)
  router.post('/', authenticate, kycUploadFields, validateKycBody, kycController.submitKyc);
  // GET  /investor/kyc         → Get full KYC + user data
  router.get('/', authenticate, kycController.getMyKyc);
  // GET  /investor/kyc/status  → Get lightweight status only
  router.get('/status', authenticate, kycController.getKycStatus);

  return router;
};
