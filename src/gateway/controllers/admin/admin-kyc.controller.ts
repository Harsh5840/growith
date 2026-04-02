import { NextFunction, Response } from 'express';
import { AdminKycService } from '../../../modules/admin/application/services/admin-kyc.service';
import { successResponse } from '../../../shared/http/api-response';
import { AuthRequest } from '../../../types/auth-request';

export class AdminKycController {
  constructor(private readonly adminKycService: AdminKycService) {}

  listKycSubmissions = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const query = {
        status: req.query.status as string | undefined,
        search: req.query.search as string | undefined,
      };
      const submissions = await this.adminKycService.listKycSubmissions(query);
      res.json(successResponse(200, 'KYC submissions retrieved', { submissions }));
    } catch (error) {
      next(error);
    }
  };

  getKycById = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ success: false, statusCode: 400, message: 'Invalid KYC ID' });
        return;
      }
      const result = await this.adminKycService.getKycById(id);
      res.json(successResponse(200, 'KYC submission retrieved', result));
    } catch (error) {
      next(error);
    }
  };

  approveKyc = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ success: false, statusCode: 400, message: 'Invalid KYC ID' });
        return;
      }
      const adminId = req.user!.userId;
      const result = await this.adminKycService.approveKyc(id, adminId);
      res.json(successResponse(200, 'KYC approved successfully', result));
    } catch (error) {
      next(error);
    }
  };

  rejectKyc = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ success: false, statusCode: 400, message: 'Invalid KYC ID' });
        return;
      }
      const adminId = req.user!.userId;
      const { reason } = req.body;
      const result = await this.adminKycService.rejectKyc(id, adminId, reason);
      res.json(successResponse(200, 'KYC rejected', result));
    } catch (error) {
      next(error);
    }
  };
}
