import { Prisma } from '@prisma/client';
import { InvestorAuthRepositoryPort } from '@core/ports/outbound/investor-auth.repository.port';
import { CreateUserInput, InvestorUser } from '../application/models/investor-user.model';
import { getPrismaClient } from '@shared/database/prisma.service';

export class PrismaInvestorAuthRepository implements InvestorAuthRepositoryPort {
  private readonly prisma = getPrismaClient();

  async findById(id: string): Promise<InvestorUser | null> {
    const user = await this.prisma.investorAuthUser.findUnique({ where: { id } });
    return user ? this.toDomain(user) : null;
  }

  async findByEmail(email: string): Promise<InvestorUser | null> {
    const user = await this.prisma.investorAuthUser.findUnique({
      where: { email: email.toLowerCase() },
    });

    return user ? this.toDomain(user) : null;
  }

  async createLocalUser(input: CreateUserInput): Promise<InvestorUser> {
    const user = await this.prisma.investorAuthUser.create({
      data: {
        email: input.email.toLowerCase(),
        fullName: input.fullName,
        passwordHash: input.password,
      },
    });

    return this.toDomain(user);
  }

  async createGoogleUser(input: Omit<CreateUserInput, 'password'> & { googleId: string; emailVerified: boolean }): Promise<InvestorUser> {
    const user = await this.prisma.investorAuthUser.create({
      data: {
        email: input.email.toLowerCase(),
        fullName: input.fullName,
        googleId: input.googleId,
        profilePicture: input.profilePicture,
        emailVerified: input.emailVerified,
      },
    });

    return this.toDomain(user);
  }

  async updateUser(id: string, patch: Partial<InvestorUser>): Promise<InvestorUser> {
    const data: Prisma.InvestorAuthUserUpdateInput = {
      email: patch.email,
      fullName: patch.fullName,
      passwordHash: patch.passwordHash,
      googleId: patch.googleId,
      profilePicture: patch.profilePicture,
      emailVerified: patch.emailVerified,
      isActive: patch.isActive,
      lastLoginAt: patch.lastLoginAt,
    };

    const user = await this.prisma.investorAuthUser.update({
      where: { id },
      data,
    });

    return this.toDomain(user);
  }

  private toDomain(user: {
    id: string;
    email: string;
    fullName: string;
    passwordHash: string | null;
    googleId: string | null;
    profilePicture: string | null;
    emailVerified: boolean;
    isActive: boolean;
    lastLoginAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): InvestorUser {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      passwordHash: user.passwordHash ?? undefined,
      googleId: user.googleId ?? undefined,
      profilePicture: user.profilePicture ?? undefined,
      emailVerified: user.emailVerified,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt ?? undefined,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
