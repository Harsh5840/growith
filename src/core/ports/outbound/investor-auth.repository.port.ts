import { CreateUserInput, InvestorUser } from '../../../modules/investor/application/models/investor-user.model';

export interface InvestorAuthRepositoryPort {
  findById(id: number): Promise<InvestorUser | null>;
  findByEmail(email: string): Promise<InvestorUser | null>;
  createLocalUser(input: CreateUserInput): Promise<InvestorUser>;
  createGoogleUser(input: Omit<CreateUserInput, 'password'> & { googleId: string; emailVerified: boolean }): Promise<InvestorUser>;
  updateUser(id: number, patch: Partial<InvestorUser>): Promise<InvestorUser>;
  setForgotPasswordCodeIfNotActive(id: number, code: string, expiresAt: Date): Promise<boolean>;
  setEmailVerificationCodeIfNotActive(id: number, code: string, expiresAt: Date): Promise<boolean>;
}

export const INVESTOR_AUTH_REPOSITORY = Symbol('INVESTOR_AUTH_REPOSITORY');
