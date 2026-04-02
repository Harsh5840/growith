import { Injectable } from '@nestjs/common';
import {
  EmailVerificationCodeIssueResult,
  ForgotPasswordCodeIssueResult,
  InvestorAuthRepositoryPort,
} from '../../../core/ports/outbound/investor-auth.repository.port';
import { CreateUserInput, InvestorUser } from '../application/models/investor-user.model';

@Injectable()
export class InMemoryInvestorAuthRepository implements InvestorAuthRepositoryPort {
  private readonly users = new Map<number, InvestorUser>();
  private nextId = 1;

  async findById(id: number): Promise<InvestorUser | null> {
    return this.users.get(id) ?? null;
  }

  async findByEmail(email: string): Promise<InvestorUser | null> {
    const loweredEmail = email.toLowerCase();
    for (const user of this.users.values()) {
      if (user.email === loweredEmail) {
        return user;
      }
    }
    return null;
  }

  async createLocalUser(input: CreateUserInput): Promise<InvestorUser> {
    const now = new Date();
    const user: InvestorUser = {
      id: this.nextId++,
      email: input.email.toLowerCase(),
      fullName: input.fullName,
      passwordHash: input.password,
      profilePicture: input.profilePicture,
      emailVerified: false,
      isActive: true,
      kycStatus: 'PENDING',
      createdAt: now,
      updatedAt: now,
    };

    this.users.set(user.id, user);
    return user;
  }

  async createGoogleUser(input: Omit<CreateUserInput, 'password'> & { googleId: string; emailVerified: boolean }): Promise<InvestorUser> {
    const now = new Date();
    const user: InvestorUser = {
      id: this.nextId++,
      email: input.email.toLowerCase(),
      fullName: input.fullName,
      googleId: input.googleId,
      profilePicture: input.profilePicture,
      emailVerified: input.emailVerified,
      isActive: true,
      kycStatus: 'PENDING',
      createdAt: now,
      updatedAt: now,
    };

    this.users.set(user.id, user);
    return user;
  }

  async updateUser(id: number, patch: Partial<InvestorUser>): Promise<InvestorUser> {
    const existing = this.users.get(id);
    if (!existing) {
      throw new Error('User not found');
    }

    const updated: InvestorUser = {
      ...existing,
      ...patch,
      updatedAt: new Date(),
    };

    this.users.set(id, updated);
    return updated;
  }

  async issueForgotPasswordCode(email: string, code: string, expiresAt: Date): Promise<ForgotPasswordCodeIssueResult> {
    const normalizedEmail = email.toLowerCase();
    const user = await this.findByEmail(normalizedEmail);
    if (!user) {
      return { status: 'not-found', email: normalizedEmail };
    }

    if (user.forgotPasswordCode && user.forgotPasswordExpires && user.forgotPasswordExpires > new Date()) {
      return { status: 'already-active', email: normalizedEmail };
    }

    await this.updateUser(user.id, {
      forgotPasswordCode: code,
      forgotPasswordExpires: expiresAt,
    });

    return { status: 'issued', email: normalizedEmail };
  }

  async issueEmailVerificationCode(email: string, code: string, expiresAt: Date): Promise<EmailVerificationCodeIssueResult> {
    const normalizedEmail = email.toLowerCase();
    const user = await this.findByEmail(normalizedEmail);
    if (!user) {
      return { status: 'not-found', email: normalizedEmail };
    }

    if (user.emailVerified) {
      return { status: 'already-verified', email: normalizedEmail };
    }

    if (user.emailVerificationCode && user.emailVerificationExpires && user.emailVerificationExpires > new Date()) {
      return { status: 'already-active', email: normalizedEmail };
    }

    await this.updateUser(user.id, {
      emailVerificationCode: code,
      emailVerificationExpires: expiresAt,
    });

    return { status: 'issued', email: normalizedEmail };
  }
}
