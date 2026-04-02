export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthUserPayload {
  id: number;
  email: string;
  fullName: string;
  profilePicture?: string;
  emailVerified: boolean;
  kycStatus: string;
}

export interface AuthResponse {
  user: AuthUserPayload;
  tokens: AuthTokens;
  codeVerified: boolean;
}

export interface ValidateEmailResponse {
  success: boolean;
  message: string;
  email: string;
}
