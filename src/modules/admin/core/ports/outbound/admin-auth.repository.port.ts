import { AdminUser, InvestorAuthUser } from '@prisma/client';

export interface AdminAuthRepositoryPort {
  createAdmin(data: Partial<AdminUser>): Promise<AdminUser>;
  findByEmail(email: string): Promise<AdminUser | null>;
  findInvestorByEmail(email: string): Promise<InvestorAuthUser | null>;
  findById(id: string): Promise<AdminUser | null>;
  updateAdmin(id: string, data: Partial<AdminUser>): Promise<AdminUser>;
  listAllInvestors(search?: string, kycStatus?: string): Promise<Partial<InvestorAuthUser>[]>;
  findInvestorById(id: string): Promise<InvestorAuthUser | null>;
  createInvestor(data: Partial<InvestorAuthUser>): Promise<InvestorAuthUser>;
  updateInvestor(id: string, data: Partial<InvestorAuthUser>): Promise<InvestorAuthUser>;
  deleteInvestor(id: string): Promise<void>;
}
