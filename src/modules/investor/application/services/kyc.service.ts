import { getPrismaClient } from '../../../../shared/database/prisma.service';
import { S3Adapter } from '../../../../shared/storage/s3.adapter';
import { HttpError } from '../../../../shared/errors/http-error';
import { SubmitKycRequestDto, KycStatusResponseDto, KycWithUserResponseDto } from '../dtos/kyc.dto';

export interface KycUploadedFiles {
  primaryDocFront?: Express.Multer.File;
  primaryDocBack?: Express.Multer.File;
  supportingDoc?: Express.Multer.File;
}

export class KycService {
  private readonly prisma = getPrismaClient();

  constructor(private readonly s3Adapter: S3Adapter) {}

  async submitKyc(userId: number, data: SubmitKycRequestDto, files: KycUploadedFiles): Promise<{ id: number; status: string }> {
    // Check if user exists
    const user = await this.prisma.investorAuthUser.findUnique({ where: { id: userId } });
    if (!user) {
      throw new HttpError(404, 'User not found');
    }

    // Check if KYC already exists
    const existingKyc = await this.prisma.investorKyc.findUnique({ where: { userId } });
    if (existingKyc && existingKyc.status === 'APPROVED') {
      throw new HttpError(400, 'KYC is already approved');
    }

    // If rejected, allow re-submission by deleting old record
    if (existingKyc && existingKyc.status === 'REJECTED') {
      // Clean up old S3 files
      try {
        await this.s3Adapter.deleteFile(existingKyc.primaryDocFrontUrl);
        if (existingKyc.primaryDocBackUrl) {
          await this.s3Adapter.deleteFile(existingKyc.primaryDocBackUrl);
        }
        if (existingKyc.supportingDocUrl) {
          await this.s3Adapter.deleteFile(existingKyc.supportingDocUrl);
        }
      } catch (e) {
        console.warn('Failed to clean up old KYC files:', e);
      }
      await this.prisma.investorKyc.delete({ where: { id: existingKyc.id } });
    }

    if (existingKyc && existingKyc.status === 'PENDING') {
      throw new HttpError(400, 'KYC is already submitted and pending review');
    }

    // Validate required files
    if (!files.primaryDocFront) {
      throw new HttpError(400, 'Primary document front side is required');
    }

    if (data.primaryDocumentType === 'AADHAAR' && !files.primaryDocBack) {
      throw new HttpError(400, 'Aadhaar card back side is required');
    }

    // Upload files to S3
    const frontKey = S3Adapter.generateKycKey(userId, data.primaryDocumentType, 'front', files.primaryDocFront.originalname);
    await this.s3Adapter.uploadFile(frontKey, files.primaryDocFront.buffer, files.primaryDocFront.mimetype);

    let backKey: string | null = null;
    if (files.primaryDocBack) {
      backKey = S3Adapter.generateKycKey(userId, data.primaryDocumentType, 'back', files.primaryDocBack.originalname);
      await this.s3Adapter.uploadFile(backKey, files.primaryDocBack.buffer, files.primaryDocBack.mimetype);
    }

    let supportingDocKey: string | null = null;
    if (files.supportingDoc) {
      supportingDocKey = S3Adapter.generateKycKey(userId, 'supporting', 'doc', files.supportingDoc.originalname);
      await this.s3Adapter.uploadFile(supportingDocKey, files.supportingDoc.buffer, files.supportingDoc.mimetype);
    }

    // Create KYC record
    const kyc = await this.prisma.investorKyc.create({
      data: {
        userId,
        fullLegalName: data.fullLegalName,
        dateOfBirth: data.dateOfBirth,
        nationality: data.nationality,
        countryOfResidence: data.countryOfResidence,
        city: data.city,
        stateProvince: data.stateProvince,
        phoneNumber: data.phoneNumber,
        streetAddress: data.streetAddress,
        primaryDocumentType: data.primaryDocumentType,
        primaryDocFrontUrl: frontKey,
        primaryDocBackUrl: backKey,
        supportingDocName: data.supportingDocName || null,
        supportingDocUrl: supportingDocKey,
        status: 'PENDING',
      },
    });

    // Update user's kycStatus
    await this.prisma.investorAuthUser.update({
      where: { id: userId },
      data: { kycStatus: 'PENDING' },
    });

    return { id: kyc.id, status: kyc.status };
  }

  async getKycStatus(userId: number): Promise<KycStatusResponseDto> {
    const kyc = await this.prisma.investorKyc.findUnique({ where: { userId } });
    
    if (!kyc) {
      return { status: 'NOT_SUBMITTED' };
    }

    return {
      status: kyc.status as KycStatusResponseDto['status'],
      rejectionReason: kyc.rejectionReason || undefined,
    };
  }

  async getKycWithUser(userId: number): Promise<KycWithUserResponseDto> {
    const user = await this.prisma.investorAuthUser.findUnique({ where: { id: userId } });
    if (!user) {
      throw new HttpError(404, 'User not found');
    }

    const kyc = await this.prisma.investorKyc.findUnique({ where: { userId } });
    if (!kyc) {
      throw new HttpError(404, 'KYC not submitted yet');
    }

    // Generate presigned URLs for documents
    const primaryDocFrontUrl = await this.s3Adapter.getSignedUrl(kyc.primaryDocFrontUrl);
    const primaryDocBackUrl = kyc.primaryDocBackUrl ? await this.s3Adapter.getSignedUrl(kyc.primaryDocBackUrl) : null;
    const supportingDocUrl = kyc.supportingDocUrl ? await this.s3Adapter.getSignedUrl(kyc.supportingDocUrl) : null;

    return {
      kyc: {
        id: kyc.id,
        fullLegalName: kyc.fullLegalName,
        dateOfBirth: kyc.dateOfBirth,
        nationality: kyc.nationality,
        countryOfResidence: kyc.countryOfResidence,
        city: kyc.city,
        stateProvince: kyc.stateProvince,
        phoneNumber: kyc.phoneNumber,
        streetAddress: kyc.streetAddress,
        primaryDocumentType: kyc.primaryDocumentType,
        primaryDocFrontUrl,
        primaryDocBackUrl,
        supportingDocName: kyc.supportingDocName,
        supportingDocUrl,
        status: kyc.status,
        rejectionReason: kyc.rejectionReason,
        reviewedAt: kyc.reviewedAt,
        createdAt: kyc.createdAt,
        updatedAt: kyc.updatedAt,
      },
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        profilePicture: user.profilePicture,
        emailVerified: user.emailVerified,
        kycStatus: user.kycStatus,
        createdAt: user.createdAt,
      },
    };
  }
}
