import { NextFunction, Response } from 'express';
import { KycService } from '../../../modules/investor/application/services/kyc.service';
import { SubmitKycRequestDto } from '../../../modules/investor/application/dtos/kyc.dto';
import { successResponse } from '../../../shared/http/api-response';
import { AuthRequest } from '../../../types/auth-request';

export class KycController {
  constructor(private readonly kycService: KycService) {}

  submitKyc = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

      const data: SubmitKycRequestDto = {
        fullLegalName: req.body.fullLegalName,
        dateOfBirth: req.body.dateOfBirth,
        nationality: req.body.nationality,
        countryOfResidence: req.body.countryOfResidence,
        city: req.body.city,
        stateProvince: req.body.stateProvince,
        phoneNumber: req.body.phoneNumber,
        streetAddress: req.body.streetAddress,
        aadhaarNumber: req.body.aadhaarNumber,
        panNumber: req.body.panNumber,
        supportingDocName: req.body.supportingDocName,
        termsAgreed: req.body.termsAgreed === 'true' || req.body.termsAgreed === true,
      };

      const uploadedFiles = {
        aadhaarFront: files?.aadhaarFront?.[0],
        aadhaarBack: files?.aadhaarBack?.[0],
        panFront: files?.panFront?.[0],
        supportingDoc: files?.supportingDoc?.[0],
      };

      const result = await this.kycService.submitKyc(userId, data, uploadedFiles);
      res.status(201).json(successResponse(201, 'KYC submitted successfully', result));
    } catch (error) {
      next(error);
    }
  };

  getKycStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const result = await this.kycService.getKycStatus(userId);
      res.json(successResponse(200, 'KYC status retrieved', result));
    } catch (error) {
      next(error);
    }
  };

  getMyKyc = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const result = await this.kycService.getKycWithUser(userId);
      res.json(successResponse(200, 'KYC data retrieved', result));
    } catch (error) {
      next(error);
    }
  };
}
