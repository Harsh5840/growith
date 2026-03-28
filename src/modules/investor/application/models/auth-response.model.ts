export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthUserPayload {
  id: string;
  email: string;
  fullName: string;
  profilePicture?: string;
  emailVerified: boolean;
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
