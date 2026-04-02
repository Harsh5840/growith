export interface SubmitKycRequestDto {
  // Personal Info
  fullLegalName: string;
  dateOfBirth: string;
  nationality: string;
  countryOfResidence: string;
  city: string;
  stateProvince: string;
  phoneNumber: string;
  streetAddress: string;

  // Document Numbers
  aadhaarNumber: string;
  panNumber: string;

  // Supporting Document (optional)
  supportingDocName?: string;

  // Terms & Conditions
  termsAgreed: boolean; // must be true
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
    aadhaarNumber: string;
    aadhaarFrontUrl: string;
    aadhaarBackUrl: string;
    panNumber: string;
    panFrontUrl: string;
    supportingDocName: string | null;
    supportingDocUrl: string | null;
    termsAgreedAt: Date;
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
