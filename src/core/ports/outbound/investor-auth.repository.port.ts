import { CreateUserInput, InvestorUser } from '../../../modules/investor/application/models/investor-user.model';

export type ForgotPasswordCodeIssueResult = {
  status: 'issued' | 'already-active' | 'not-found';
  email: string;
};

export type EmailVerificationCodeIssueResult = {
  status: 'issued' | 'already-active' | 'already-verified' | 'not-found';
  email: string;
};

export interface InvestorAuthRepositoryPort {
  findById(id: number): Promise<InvestorUser | null>;
  findByEmail(email: string): Promise<InvestorUser | null>;
  createLocalUser(input: CreateUserInput): Promise<InvestorUser>;
  createGoogleUser(input: Omit<CreateUserInput, 'password'> & { googleId: string; emailVerified: boolean }): Promise<InvestorUser>;
  updateUser(id: number, patch: Partial<InvestorUser>): Promise<InvestorUser>;
  issueForgotPasswordCode(email: string, code: string, expiresAt: Date): Promise<ForgotPasswordCodeIssueResult>;
  issueEmailVerificationCode(email: string, code: string, expiresAt: Date): Promise<EmailVerificationCodeIssueResult>;
}

export const INVESTOR_AUTH_REPOSITORY = Symbol('INVESTOR_AUTH_REPOSITORY');
