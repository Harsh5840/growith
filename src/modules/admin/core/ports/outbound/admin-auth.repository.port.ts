import { AdminUser, InvestorAuthUser } from '@prisma/client';

export interface AdminAuthRepositoryPort {
  createAdmin(data: Partial<AdminUser>): Promise<AdminUser>;
  findByEmail(email: string): Promise<AdminUser | null>;
  findInvestorByEmail(email: string): Promise<InvestorAuthUser | null>;
  findById(id: number): Promise<AdminUser | null>;
  updateAdmin(id: number, data: Partial<AdminUser>): Promise<AdminUser>;
  listAllInvestors(search?: string, kycStatus?: string): Promise<Partial<InvestorAuthUser>[]>;
  findInvestorById(id: number): Promise<InvestorAuthUser | null>;
  createInvestor(data: Partial<InvestorAuthUser>): Promise<InvestorAuthUser>;
  updateInvestor(id: number, data: Partial<InvestorAuthUser>): Promise<InvestorAuthUser>;
  deleteInvestor(id: number): Promise<void>;
}
