import { Prisma } from '@prisma/client';
import {
  EmailVerificationCodeIssueResult,
  ForgotPasswordCodeIssueResult,
  InvestorAuthRepositoryPort,
} from '../../../core/ports/outbound/investor-auth.repository.port';
import { CreateUserInput, InvestorUser } from '../application/models/investor-user.model';
import { getPrismaClient } from '../../../shared/database/prisma.service';

export class PrismaInvestorAuthRepository implements InvestorAuthRepositoryPort {
  private readonly prisma = getPrismaClient();

  async findById(id: number): Promise<InvestorUser | null> {
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

  async updateUser(id: number, patch: Partial<InvestorUser>): Promise<InvestorUser> {
    const data: Prisma.InvestorAuthUserUpdateInput = {
      email: patch.email,
      fullName: patch.fullName,
      passwordHash: patch.passwordHash,
      googleId: patch.googleId,
      profilePicture: patch.profilePicture,
      emailVerified: patch.emailVerified,
      isActive: patch.isActive,
      forgotPasswordCode: patch.forgotPasswordCode,
      forgotPasswordExpires: patch.forgotPasswordExpires,
      emailVerificationCode: patch.emailVerificationCode,
      emailVerificationExpires: patch.emailVerificationExpires,
      lastLoginAt: patch.lastLoginAt,
      kycStatus: patch.kycStatus,
    };

    const user = await this.prisma.investorAuthUser.update({
      where: { id },
      data,
    });

    return this.toDomain(user);
  }

  async issueForgotPasswordCode(email: string, code: string, expiresAt: Date): Promise<ForgotPasswordCodeIssueResult> {
    const normalizedEmail = email.toLowerCase();

    const rows = await this.prisma.$queryRaw<Array<{ status: 'issued' | 'already-active' | 'not-found' }>>`
      WITH locked_user AS (
        SELECT "id", "forgotPasswordExpires"
        FROM "InvestorAuthUser"
        WHERE "email" = ${normalizedEmail}
        FOR UPDATE
      ),
      updated AS (
        UPDATE "InvestorAuthUser" u
        SET "forgotPasswordCode" = ${code},
            "forgotPasswordExpires" = ${expiresAt}
        FROM locked_user lu
        WHERE u."id" = lu."id"
          AND (lu."forgotPasswordExpires" IS NULL OR lu."forgotPasswordExpires" <= NOW())
        RETURNING u."id"
      )
      SELECT CASE
        WHEN NOT EXISTS (SELECT 1 FROM locked_user) THEN 'not-found'
        WHEN EXISTS (SELECT 1 FROM updated) THEN 'issued'
        ELSE 'already-active'
      END AS status
    `;

    return { status: rows[0]?.status ?? 'not-found', email: normalizedEmail };
  }

  async issueEmailVerificationCode(email: string, code: string, expiresAt: Date): Promise<EmailVerificationCodeIssueResult> {
    const normalizedEmail = email.toLowerCase();

    const rows = await this.prisma.$queryRaw<Array<{ status: 'issued' | 'already-active' | 'already-verified' | 'not-found' }>>`
      WITH locked_user AS (
        SELECT "id", "emailVerified", "emailVerificationExpires"
        FROM "InvestorAuthUser"
        WHERE "email" = ${normalizedEmail}
        FOR UPDATE
      ),
      updated AS (
        UPDATE "InvestorAuthUser" u
        SET "emailVerificationCode" = ${code},
            "emailVerificationExpires" = ${expiresAt}
        FROM locked_user lu
        WHERE u."id" = lu."id"
          AND lu."emailVerified" = false
          AND (lu."emailVerificationExpires" IS NULL OR lu."emailVerificationExpires" <= NOW())
        RETURNING u."id"
      )
      SELECT CASE
        WHEN NOT EXISTS (SELECT 1 FROM locked_user) THEN 'not-found'
        WHEN EXISTS (SELECT 1 FROM updated) THEN 'issued'
        WHEN EXISTS (SELECT 1 FROM locked_user WHERE "emailVerified" = true) THEN 'already-verified'
        ELSE 'already-active'
      END AS status
    `;

    return { status: rows[0]?.status ?? 'not-found', email: normalizedEmail };
  }

  private toDomain(user: {
    id: number;
    email: string;
    fullName: string;
    passwordHash: string | null;
    googleId: string | null;
    profilePicture: string | null;
    emailVerified: boolean;
    isActive: boolean;
    forgotPasswordCode: string | null;
    forgotPasswordExpires: Date | null;
    emailVerificationCode: string | null;
    emailVerificationExpires: Date | null;
    lastLoginAt: Date | null;
    kycStatus: string;
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
      forgotPasswordCode: user.forgotPasswordCode ?? undefined,
      forgotPasswordExpires: user.forgotPasswordExpires ?? undefined,
      emailVerificationCode: user.emailVerificationCode ?? undefined,
      emailVerificationExpires: user.emailVerificationExpires ?? undefined,
      lastLoginAt: user.lastLoginAt ?? undefined,
      kycStatus: user.kycStatus,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
