export interface AdminRegisterRequestDto {
  email: string;
  fullName: string;
  password: string;
  adminRegistrationSecret?: string;
}

export interface AdminLoginRequestDto {
  email: string;
  password: string;
}

export interface AdminAuthResponse {
  user: {
    id: number;
    email: string;
    fullName: string;
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
}

export interface AdminForgotPasswordDto {
  email: string;
}

export interface AdminResetPasswordDto {
  email: string;
  code: string;
  newPassword: string;
  confirmPassword: string;
}

export interface AdminCreateUserDto {
  email: string;
  fullName: string;
  password?: string;
}

export interface AdminEditUserDto {
  fullName?: string;
  isActive?: boolean;
}

export interface AdminListUsersQueryDto {
  search?: string;
  kycStatus?: string;
}
