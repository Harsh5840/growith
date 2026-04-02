import { getPrismaClient } from '../../../../shared/database/prisma.service';
import { S3Adapter } from '../../../../shared/storage/s3.adapter';
import { HttpError } from '../../../../shared/errors/http-error';

export interface AdminKycListQuery {
  status?: string;
  search?: string;
}

export class AdminKycService {
  private readonly prisma = getPrismaClient();

  constructor(private readonly s3Adapter: S3Adapter) {}

  async listKycSubmissions(query: AdminKycListQuery) {
    const whereClause: any = {};

    if (query.status) {
      whereClause.status = query.status;
    }

    if (query.search) {
      whereClause.OR = [
        { fullLegalName: { contains: query.search, mode: 'insensitive' } },
        { user: { email: { contains: query.search, mode: 'insensitive' } } },
        { user: { fullName: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    const submissions = await this.prisma.investorKyc.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            profilePicture: true,
            emailVerified: true,
            kycStatus: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return submissions.map((s) => ({
      id: s.id,
      userId: s.userId,
      fullLegalName: s.fullLegalName,
      aadhaarNumber: s.aadhaarNumber,
      panNumber: s.panNumber,
      status: s.status,
      rejectionReason: s.rejectionReason,
      reviewedAt: s.reviewedAt,
      createdAt: s.createdAt,
      user: s.user,
    }));
  }

  async getKycById(kycId: number) {
    const kyc = await this.prisma.investorKyc.findUnique({
      where: { id: kycId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            profilePicture: true,
            emailVerified: true,
            kycStatus: true,
            isActive: true,
            createdAt: true,
          },
        },
      },
    });

    if (!kyc) {
      throw new HttpError(404, 'KYC submission not found');
    }

    // Generate presigned URLs
    const aadhaarFrontUrl = await this.s3Adapter.getSignedUrl(kyc.aadhaarFrontUrl);
    const aadhaarBackUrl = await this.s3Adapter.getSignedUrl(kyc.aadhaarBackUrl);
    const panFrontUrl = await this.s3Adapter.getSignedUrl(kyc.panFrontUrl);
    const supportingDocUrl = kyc.supportingDocUrl
      ? await this.s3Adapter.getSignedUrl(kyc.supportingDocUrl)
      : null;

    return {
      kyc: {
        id: kyc.id,
        userId: kyc.userId,
        fullLegalName: kyc.fullLegalName,
        dateOfBirth: kyc.dateOfBirth,
        nationality: kyc.nationality,
        countryOfResidence: kyc.countryOfResidence,
        city: kyc.city,
        stateProvince: kyc.stateProvince,
        phoneNumber: kyc.phoneNumber,
        streetAddress: kyc.streetAddress,
        aadhaarNumber: kyc.aadhaarNumber,
        aadhaarFrontUrl,
        aadhaarBackUrl,
        panNumber: kyc.panNumber,
        panFrontUrl,
        supportingDocName: kyc.supportingDocName,
        supportingDocUrl,
        termsAgreedAt: kyc.termsAgreedAt,
        status: kyc.status,
        rejectionReason: kyc.rejectionReason,
        reviewedBy: kyc.reviewedBy,
        reviewedAt: kyc.reviewedAt,
        createdAt: kyc.createdAt,
        updatedAt: kyc.updatedAt,
      },
      user: kyc.user,
    };
  }

  async approveKyc(kycId: number, adminId: number) {
    const kyc = await this.prisma.investorKyc.findUnique({ where: { id: kycId } });
    if (!kyc) {
      throw new HttpError(404, 'KYC submission not found');
    }

    if (kyc.status === 'APPROVED') {
      throw new HttpError(400, 'KYC is already approved');
    }

    const updatedKyc = await this.prisma.investorKyc.update({
      where: { id: kycId },
      data: {
        status: 'APPROVED',
        rejectionReason: null,
        reviewedBy: adminId,
        reviewedAt: new Date(),
      },
    });

    await this.prisma.investorAuthUser.update({
      where: { id: kyc.userId },
      data: { kycStatus: 'APPROVED' },
    });

    return {
      id: updatedKyc.id,
      status: updatedKyc.status,
      reviewedAt: updatedKyc.reviewedAt,
    };
  }

  async rejectKyc(kycId: number, adminId: number, reason: string) {
    if (!reason || reason.trim().length === 0) {
      throw new HttpError(400, 'Rejection reason is required');
    }

    const kyc = await this.prisma.investorKyc.findUnique({ where: { id: kycId } });
    if (!kyc) {
      throw new HttpError(404, 'KYC submission not found');
    }

    if (kyc.status === 'APPROVED') {
      throw new HttpError(400, 'Cannot reject an already approved KYC');
    }

    const updatedKyc = await this.prisma.investorKyc.update({
      where: { id: kycId },
      data: {
        status: 'REJECTED',
        rejectionReason: reason.trim(),
        reviewedBy: adminId,
        reviewedAt: new Date(),
      },
    });

    await this.prisma.investorAuthUser.update({
      where: { id: kyc.userId },
      data: { kycStatus: 'REJECTED' },
    });

    return {
      id: updatedKyc.id,
      status: updatedKyc.status,
      rejectionReason: updatedKyc.rejectionReason,
      reviewedAt: updatedKyc.reviewedAt,
    };
  }
}
