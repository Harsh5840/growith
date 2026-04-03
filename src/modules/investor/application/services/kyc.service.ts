import { getPrismaClient } from '../../../../shared/database/prisma.service';
import { S3Adapter } from '../../../../shared/storage/s3.adapter';
import { HttpError } from '../../../../shared/errors/http-error';
import { SubmitKycRequestDto, KycStatusResponseDto, KycWithUserResponseDto } from '../dtos/kyc.dto';

export interface KycUploadedFiles {
  aadhaarFront?: Express.Multer.File;
  aadhaarBack?: Express.Multer.File;
  panFront?: Express.Multer.File;
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
      try {
        await this.s3Adapter.deleteFile(existingKyc.aadhaarFrontUrl);
        await this.s3Adapter.deleteFile(existingKyc.aadhaarBackUrl);
        await this.s3Adapter.deleteFile(existingKyc.panFrontUrl);
        if (existingKyc.supportingDocUrl) {
          await this.s3Adapter.deleteFile(existingKyc.supportingDocUrl);
        }
      } catch (e) {
        console.warn('Failed to clean up old KYC files:', e);
      }
      await this.prisma.investorKyc.delete({ where: { id: existingKyc.id } });
    }

    if (existingKyc && existingKyc.status === 'PENDING_APPROVAL') {
      throw new HttpError(400, 'KYC is already submitted and pending review');
    }

    // T&C check
    if (!data.termsAgreed) {
      throw new HttpError(400, 'You must agree to the Terms & Conditions');
    }

    // Validate required files
    if (!files.aadhaarFront) {
      throw new HttpError(400, 'Aadhaar card front side is required');
    }
    if (!files.aadhaarBack) {
      throw new HttpError(400, 'Aadhaar card back side is required');
    }
    if (!files.panFront) {
      throw new HttpError(400, 'PAN card front side is required');
    }

    // Upload Aadhaar files to S3
    const aadhaarFrontKey = S3Adapter.generateKycKey(userId, 'aadhaar', 'front', files.aadhaarFront.originalname);
    await this.s3Adapter.uploadFile(aadhaarFrontKey, files.aadhaarFront.buffer, files.aadhaarFront.mimetype);

    const aadhaarBackKey = S3Adapter.generateKycKey(userId, 'aadhaar', 'back', files.aadhaarBack.originalname);
    await this.s3Adapter.uploadFile(aadhaarBackKey, files.aadhaarBack.buffer, files.aadhaarBack.mimetype);

    // Upload PAN file to S3
    const panFrontKey = S3Adapter.generateKycKey(userId, 'pan', 'front', files.panFront.originalname);
    await this.s3Adapter.uploadFile(panFrontKey, files.panFront.buffer, files.panFront.mimetype);

    // Upload supporting document (optional)
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
        aadhaarNumber: data.aadhaarNumber,
        aadhaarFrontUrl: aadhaarFrontKey,
        aadhaarBackUrl: aadhaarBackKey,
        panNumber: data.panNumber,
        panFrontUrl: panFrontKey,
        supportingDocName: data.supportingDocName || null,
        supportingDocUrl: supportingDocKey,
        termsAgreedAt: new Date(),
        status: 'PENDING_APPROVAL',
      },
    });

    // Update user's kycStatus
    await this.prisma.investorAuthUser.update({
      where: { id: userId },
      data: { kycStatus: 'PENDING_APPROVAL' },
    });

    return { id: kyc.id, status: kyc.status };
  }

  async getKycStatus(userId: number): Promise<KycStatusResponseDto> {
    const kyc = await this.prisma.investorKyc.findUnique({ where: { userId } });

    if (!kyc) {
      return { status: 'PENDING' };
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
    const aadhaarFrontUrl = await this.s3Adapter.getSignedUrl(kyc.aadhaarFrontUrl);
    const aadhaarBackUrl = await this.s3Adapter.getSignedUrl(kyc.aadhaarBackUrl);
    const panFrontUrl = await this.s3Adapter.getSignedUrl(kyc.panFrontUrl);
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
