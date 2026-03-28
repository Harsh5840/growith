import {
  GoogleAuthRequestDto,
  LoginRequestDto,
  RefreshTokenRequestDto,
  RegisterRequestDto,
  ValidateEmailRequestDto,
} from '@modules/investor/application/dtos/auth.dto';
import { AuthResponse, ValidateEmailResponse } from '@modules/investor/application/models/auth-response.model';

export interface InvestorAuthUseCasePort {
  register(input: RegisterRequestDto): Promise<AuthResponse>;
  login(input: LoginRequestDto): Promise<AuthResponse>;
  validateEmail(input: ValidateEmailRequestDto): Promise<ValidateEmailResponse>;
  googleAuth(input: GoogleAuthRequestDto): Promise<AuthResponse>;
  getGoogleAuthUrl(): Promise<string>;
  refreshToken(input: RefreshTokenRequestDto): Promise<{ accessToken: string; refreshToken: string }>;
  me(userId: string): Promise<AuthResponse['user']>;
  sendPasswordResetEmail(email: string): Promise<void>;
  resetPassword(token: string, newPassword: string, confirmPassword: string): Promise<void>;
}

export const INVESTOR_AUTH_USECASE = Symbol('INVESTOR_AUTH_USECASE');
