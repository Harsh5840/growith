export interface SubmitKycRequestDto {
  // Step 1: Personal Info
  fullLegalName: string;
  dateOfBirth: string;
  nationality: string;
  countryOfResidence: string;
  city: string;
  stateProvince: string;
  phoneNumber: string;
  streetAddress: string;

  // Step 2: Primary Document
  primaryDocumentType: 'AADHAAR' | 'PAN';

  // Step 2: Supporting Document (optional)
  supportingDocName?: string;
}

export interface KycStatusResponseDto {
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'NOT_SUBMITTED';
  rejectionReason?: string;
}

export interface KycWithUserResponseDto {
  kyc: {
    id: number;
    fullLegalName: string;
    dateOfBirth: string;
    nationality: string;
    countryOfResidence: string;
    city: string;
    stateProvince: string;
    phoneNumber: string;
    streetAddress: string;
    primaryDocumentType: string;
    primaryDocFrontUrl: string;
    primaryDocBackUrl: string | null;
    supportingDocName: string | null;
    supportingDocUrl: string | null;
    status: string;
    rejectionReason: string | null;
    reviewedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  };
  user: {
    id: number;
    email: string;
    fullName: string;
    profilePicture: string | null;
    emailVerified: boolean;
    kycStatus: string;
    createdAt: Date;
  };
}
