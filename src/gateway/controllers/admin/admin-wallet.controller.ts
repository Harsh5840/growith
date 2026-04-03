import { NextFunction, Response } from 'express';
import { AdminWalletService } from '../../../modules/admin/application/services/admin-wallet.service';
import { AdminReviewPurchaseRequestDto } from '../../../modules/admin/application/dtos/admin-wallet.dto';
import { successResponse } from '../../../shared/http/api-response';
import { AuthRequest } from '../../../types/auth-request';

export class AdminWalletController {
  constructor(private readonly adminWalletService: AdminWalletService) {}

  listPurchaseRequests = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userIdQuery = req.query.userId as string | undefined;
      const query = {
        status: req.query.status as string | undefined,
        search: req.query.search as string | undefined,
        userId: userIdQuery ? Number.parseInt(userIdQuery, 10) : undefined,
      };

      const result = await this.adminWalletService.listPurchaseRequests(query);
      res.json(successResponse(200, 'Purchase requests retrieved', result));
    } catch (error) {
      next(error);
    }
  };

  getPurchaseRequestById = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const id = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        res.status(400).json({ success: false, statusCode: 400, message: 'Invalid request ID' });
        return;
      }

      const result = await this.adminWalletService.getPurchaseRequestById(id);
      res.json(successResponse(200, 'Purchase request retrieved', result));
    } catch (error) {
      next(error);
    }
  };

  reviewPurchaseRequest = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const id = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        res.status(400).json({ success: false, statusCode: 400, message: 'Invalid request ID' });
        return;
      }

      const adminId = req.user!.userId;
      const body = req.body as AdminReviewPurchaseRequestDto;
      const input: AdminReviewPurchaseRequestDto = {
        action: body.action,
        reason: body.reason,
        note: body.note,
      };

      const result = await this.adminWalletService.reviewPurchaseRequest(id, adminId, input);
      res.json(successResponse(200, 'Purchase request reviewed successfully', result));
    } catch (error) {
      next(error);
    }
  };
}
