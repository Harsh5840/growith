import { CreateUserInput, InvestorUser } from '@modules/investor/application/models/investor-user.model';

export interface InvestorAuthRepositoryPort {
  findById(id: string): Promise<InvestorUser | null>;
  findByEmail(email: string): Promise<InvestorUser | null>;
  createLocalUser(input: CreateUserInput): Promise<InvestorUser>;
  createGoogleUser(input: Omit<CreateUserInput, 'password'> & { googleId: string; emailVerified: boolean }): Promise<InvestorUser>;
  updateUser(id: string, patch: Partial<InvestorUser>): Promise<InvestorUser>;
}

export const INVESTOR_AUTH_REPOSITORY = Symbol('INVESTOR_AUTH_REPOSITORY');
