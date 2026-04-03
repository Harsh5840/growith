import { TokenPurchaseRequest } from '@prisma/client';
import { getPrismaClient } from '../../../../shared/database/prisma.service';
import { HttpError } from '../../../../shared/errors/http-error';
import { S3Adapter } from '../../../../shared/storage/s3.adapter';
import {
  CreateTokenPurchaseRequestDto,
  TOKEN_PRICE_USD,
  TokenPurchaseRequestResponseDto,
  WalletOverviewResponseDto,
} from '../dtos/wallet.dto';

export interface WalletUploadedFiles {
  paymentProof?: Express.Multer.File;
}

export class WalletService {
  private readonly prisma = getPrismaClient();

  constructor(private readonly s3Adapter: S3Adapter) {}

  async getWalletOverview(userId: number): Promise<WalletOverviewResponseDto> {
    const user = await this.prisma.investorAuthUser.findUnique({
      where: { id: userId },
      select: { id: true, walletTokenBalance: true },
    });

    if (!user) {
      throw new HttpError(404, 'User not found');
    }

    const marketplaceAccess = await this.getMarketplaceAccess(userId);

    return {
      walletTokenBalance: user.walletTokenBalance,
      tokenPriceUsd: TOKEN_PRICE_USD,
      canAccessMarketplace: marketplaceAccess.canAccessMarketplace,
      marketplaceStatus: marketplaceAccess.canAccessMarketplace ? 'OPEN' : 'LOCKED',
      reason: marketplaceAccess.reason,
    };
  }

  async createPurchaseRequest(
    userId: number,
    input: CreateTokenPurchaseRequestDto,
    files: WalletUploadedFiles,
  ): Promise<TokenPurchaseRequestResponseDto> {
    if (!Number.isInteger(input.tokenCount) || input.tokenCount <= 0) {
      throw new HttpError(400, 'Token count must be a positive whole number');
    }

    const user = await this.prisma.investorAuthUser.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new HttpError(404, 'User not found');
    }

    const marketplaceAccess = await this.getMarketplaceAccess(userId);
    if (!marketplaceAccess.canAccessMarketplace) {
      throw new HttpError(403, marketplaceAccess.reason || 'Marketplace is locked for your account');
    }

    if (!files.paymentProof) {
      throw new HttpError(400, 'Payment screenshot is required');
    }

    const paymentProofKey = S3Adapter.generateWalletPaymentProofKey(userId, files.paymentProof.originalname);
    await this.s3Adapter.uploadFile(paymentProofKey, files.paymentProof.buffer, files.paymentProof.mimetype);

    const totalAmountUsd = input.tokenCount * TOKEN_PRICE_USD;

    const request = await this.prisma.tokenPurchaseRequest.create({
      data: {
        userId,
        requestedTokenCount: input.tokenCount,
        totalAmountUsd,
        paymentProofUrl: paymentProofKey,
        status: 'PENDING',
      },
    });

    return this.toResponse(request, true);
  }

  async listMyPurchaseRequests(userId: number): Promise<{ requests: TokenPurchaseRequestResponseDto[] }> {
    const user = await this.prisma.investorAuthUser.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new HttpError(404, 'User not found');
    }

    const requests = await this.prisma.tokenPurchaseRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    const mapped = await Promise.all(requests.map((request) => this.toResponse(request, true)));

    return { requests: mapped };
  }

  private async getMarketplaceAccess(
    userId: number,
  ): Promise<{ canAccessMarketplace: boolean; reason?: string }> {
    const kyc = await this.prisma.investorKyc.findUnique({
      where: { userId },
      select: { status: true },
    });

    if (!kyc) {
      return {
        canAccessMarketplace: false,
        reason: 'Submit your KYC first to access the marketplace',
      };
    }

    if (kyc.status !== 'PENDING_APPROVAL' && kyc.status !== 'APPROVED') {
      return {
        canAccessMarketplace: false,
        reason: 'Marketplace is available only when KYC is pending review or approved',
      };
    }

    return { canAccessMarketplace: true };
  }

  private async toResponse(
    request: TokenPurchaseRequest,
    includeSignedPaymentProof: boolean,
  ): Promise<TokenPurchaseRequestResponseDto> {
    const paymentProofUrl = includeSignedPaymentProof
      ? await this.s3Adapter.getSignedUrl(request.paymentProofUrl)
      : request.paymentProofUrl;

    return {
      id: request.id,
      requestedTokenCount: request.requestedTokenCount,
      totalAmountUsd: Number(request.totalAmountUsd),
      paymentProofUrl,
      status: request.status,
      rejectionReason: request.rejectionReason,
      adminNote: request.adminNote,
      reviewedBy: request.reviewedBy,
      reviewedAt: request.reviewedAt,
      creditedAt: request.creditedAt,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
    };
  }
}
