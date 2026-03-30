export interface InvestorUser {
  id: string;
  email: string;
  fullName: string;
  passwordHash?: string;
  googleId?: string;
  profilePicture?: string;
  emailVerified: boolean;
  isActive: boolean;
  forgotPasswordCode?: string;
  forgotPasswordExpires?: Date;
  emailVerificationCode?: string;
  emailVerificationExpires?: Date;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserInput {
  email: string;
  fullName: string;
  password?: string;
  profilePicture?: string;
}
