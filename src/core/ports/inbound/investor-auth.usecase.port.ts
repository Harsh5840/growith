import {
  GoogleAuthRequestDto,
  LoginRequestDto,
  RefreshTokenRequestDto,
  RegisterRequestDto,
  ResetPasswordRequestDto,
  ValidateEmailRequestDto,
  VerifyEmailRequestDto,
  VerifyForgotPasswordCodeDto,
} from '@modules/investor/application/dtos/auth.dto';
import { AuthResponse, ValidateEmailResponse } from '../../../modules/investor/application/models/auth-response.model';

export interface InvestorAuthUseCasePort {
  register(input: RegisterRequestDto): Promise<AuthResponse>;
  login(input: LoginRequestDto): Promise<AuthResponse>;
  validateEmail(input: ValidateEmailRequestDto): Promise<ValidateEmailResponse>;
  googleAuth(input: GoogleAuthRequestDto): Promise<AuthResponse>;
  getGoogleAuthUrl(): Promise<string>;
  refreshToken(input: RefreshTokenRequestDto): Promise<{ accessToken: string; refreshToken: string }>;
  me(userId: number): Promise<AuthResponse['user']>;
  sendPasswordResetEmail(email: string): Promise<void>;
  verifyForgotPasswordCode(input: VerifyForgotPasswordCodeDto): Promise<{ success: boolean; message: string }>;
  resetPassword(input: ResetPasswordRequestDto): Promise<void>;
  sendEmailVerification(email: string): Promise<void>;
  verifyEmail(input: VerifyEmailRequestDto): Promise<{ success: boolean; message: string }>;
}

export const INVESTOR_AUTH_USECASE = Symbol('INVESTOR_AUTH_USECASE');
