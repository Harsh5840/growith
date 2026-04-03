import { NextFunction, Response } from 'express';
import { WalletService } from '../../../modules/investor/application/services/wallet.service';
import { successResponse } from '../../../shared/http/api-response';
import { AuthRequest } from '../../../types/auth-request';

export class WalletController {
	constructor(private readonly walletService: WalletService) {}

	getWalletOverview = async (req: AuthRequest, res: Response, next: NextFunction) => {
		try {
			const userId = req.user!.userId;
			const result = await this.walletService.getWalletOverview(userId);
			res.json(successResponse(200, 'Wallet overview retrieved', result));
		} catch (error) {
			next(error);
		}
	};

	createPurchaseRequest = async (req: AuthRequest, res: Response, next: NextFunction) => {
		try {
			const userId = req.user!.userId;
			const tokenCount = typeof req.body.tokenCount === 'number'
				? req.body.tokenCount
				: Number.parseInt(req.body.tokenCount, 10);

			const result = await this.walletService.createPurchaseRequest(
				userId,
				{ tokenCount },
				{ paymentProof: req.file || undefined },
			);

			res.status(201).json(successResponse(201, 'Purchase request submitted and sent for admin approval', result));
		} catch (error) {
			next(error);
		}
	};

	listMyPurchaseRequests = async (req: AuthRequest, res: Response, next: NextFunction) => {
		try {
			const userId = req.user!.userId;
			const result = await this.walletService.listMyPurchaseRequests(userId);
			res.json(successResponse(200, 'Purchase requests retrieved', result));
		} catch (error) {
			next(error);
		}
	};
}
