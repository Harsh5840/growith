import { TokenPurchaseRequest } from '@prisma/client';
import { getPrismaClient } from '../../../../shared/database/prisma.service';
import { HttpError } from '../../../../shared/errors/http-error';
import { S3Adapter } from '../../../../shared/storage/s3.adapter';
import {
  AdminListPurchaseRequestsQueryDto,
  AdminReviewPurchaseRequestDto,
} from '../dtos/admin-wallet.dto';

export class AdminWalletService {
  private readonly prisma = getPrismaClient();

  constructor(private readonly s3Adapter: S3Adapter) {}

  async listPurchaseRequests(query: AdminListPurchaseRequestsQueryDto) {
    const whereClause: any = {};

    if (query.status) {
      whereClause.status = query.status;
    }

    if (query.userId) {
      whereClause.userId = query.userId;
    }

    if (query.search) {
      whereClause.OR = [
        { user: { email: { contains: query.search, mode: 'insensitive' } } },
        { user: { fullName: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    const requests = await this.prisma.tokenPurchaseRequest.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            walletTokenBalance: true,
            kycStatus: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const mapped = await Promise.all(
      requests.map(async (request) => ({
        ...this.toResponse(request),
        paymentProofUrl: await this.s3Adapter.getSignedUrl(request.paymentProofUrl),
        user: request.user,
      })),
    );

    return { requests: mapped };
  }

  async getPurchaseRequestById(requestId: number) {
    const request = await this.prisma.tokenPurchaseRequest.findUnique({
      where: { id: requestId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            walletTokenBalance: true,
            kycStatus: true,
          },
        },
      },
    });

    if (!request) {
      throw new HttpError(404, 'Purchase request not found');
    }

    return {
      request: {
        ...this.toResponse(request),
        paymentProofUrl: await this.s3Adapter.getSignedUrl(request.paymentProofUrl),
      },
      user: request.user,
    };
  }

  async reviewPurchaseRequest(requestId: number, adminId: number, input: AdminReviewPurchaseRequestDto) {
    if (input.action === 'REJECT' && (!input.reason || input.reason.trim().length === 0)) {
      throw new HttpError(400, 'Rejection reason is required when rejecting a request');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.tokenPurchaseRequest.findUnique({ where: { id: requestId } });

      if (!existing) {
        throw new HttpError(404, 'Purchase request not found');
      }

      if (existing.status !== 'PENDING') {
        throw new HttpError(400, `Purchase request is already ${existing.status.toLowerCase()}`);
      }

      const reviewedAt = new Date();
      const adminNote = input.note?.trim() || null;

      if (input.action === 'APPROVE') {
        const approvedRequest = await tx.tokenPurchaseRequest.update({
          where: { id: requestId },
          data: {
            status: 'APPROVED',
            rejectionReason: null,
            adminNote,
            reviewedBy: adminId,
            reviewedAt,
            creditedAt: reviewedAt,
          },
        });

        await tx.investorAuthUser.update({
          where: { id: existing.userId },
          data: {
            walletTokenBalance: {
              increment: existing.requestedTokenCount,
            },
          },
        });

        return approvedRequest;
      }

      return tx.tokenPurchaseRequest.update({
        where: { id: requestId },
        data: {
          status: 'REJECTED',
          rejectionReason: input.reason!.trim(),
          adminNote,
          reviewedBy: adminId,
          reviewedAt,
          creditedAt: null,
        },
      });
    });

    return {
      request: {
        ...this.toResponse(updated),
        paymentProofUrl: await this.s3Adapter.getSignedUrl(updated.paymentProofUrl),
      },
    };
  }

  private toResponse(request: TokenPurchaseRequest) {
    return {
      id: request.id,
      userId: request.userId,
      requestedTokenCount: request.requestedTokenCount,
      totalAmountUsd: Number(request.totalAmountUsd),
      paymentProofUrl: request.paymentProofUrl,
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
