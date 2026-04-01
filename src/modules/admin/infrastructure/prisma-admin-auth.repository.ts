import { PrismaClient, AdminUser, InvestorAuthUser } from '@prisma/client';
import { AdminAuthRepositoryPort } from '../core/ports/outbound/admin-auth.repository.port';

const prisma = new PrismaClient();

export class PrismaAdminAuthRepository implements AdminAuthRepositoryPort {
  async createAdmin(data: Partial<AdminUser>): Promise<AdminUser> {
    return prisma.adminUser.create({
      data: {
        email: data.email as string,
        fullName: data.fullName as string,
        passwordHash: data.passwordHash as string,
      },
    });
  }

  async findByEmail(email: string): Promise<AdminUser | null> {
    return prisma.adminUser.findUnique({
      where: { email },
    });
  }

  async findInvestorByEmail(email: string): Promise<InvestorAuthUser | null> {
    return prisma.investorAuthUser.findUnique({
      where: { email },
    });
  }

  async findById(id: string): Promise<AdminUser | null> {
    return prisma.adminUser.findUnique({
      where: { id },
    });
  }

  async updateAdmin(id: string, data: Partial<AdminUser>): Promise<AdminUser> {
    return prisma.adminUser.update({
      where: { id },
      data,
    });
  }

  async listAllInvestors(search?: string, kycStatus?: string): Promise<Partial<InvestorAuthUser>[]> {
    const whereClause: any = {};
    if (search) {
      whereClause.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (kycStatus) {
      whereClause.kycStatus = kycStatus;
    }

    const investors = await prisma.investorAuthUser.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
    });
    
    // Omit sensitive data
    return investors.map(investor => {
      const { passwordHash, forgotPasswordCode, emailVerificationCode, ...safeUser } = investor;
      return safeUser as Partial<InvestorAuthUser>;
    });
  }

  async findInvestorById(id: string): Promise<InvestorAuthUser | null> {
    return prisma.investorAuthUser.findUnique({
      where: { id },
    });
  }

  async createInvestor(data: Partial<InvestorAuthUser>): Promise<InvestorAuthUser> {
    return prisma.investorAuthUser.create({
      data: data as any,
    });
  }

  async updateInvestor(id: string, data: Partial<InvestorAuthUser>): Promise<InvestorAuthUser> {
    return prisma.investorAuthUser.update({
      where: { id },
      data,
    });
  }

  async deleteInvestor(id: string): Promise<void> {
    await prisma.investorAuthUser.delete({
      where: { id },
    });
  }
}
