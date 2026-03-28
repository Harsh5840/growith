import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { InvestorAuthRepositoryPort } from '@core/ports/outbound/investor-auth.repository.port';
import { CreateUserInput, InvestorUser } from '../application/models/investor-user.model';

@Injectable()
export class InMemoryInvestorAuthRepository implements InvestorAuthRepositoryPort {
  private readonly users = new Map<string, InvestorUser>();

  async findById(id: string): Promise<InvestorUser | null> {
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
      id: randomUUID(),
      email: input.email.toLowerCase(),
      fullName: input.fullName,
      passwordHash: input.password,
      profilePicture: input.profilePicture,
      emailVerified: false,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    this.users.set(user.id, user);
    return user;
  }

  async createGoogleUser(input: Omit<CreateUserInput, 'password'> & { googleId: string; emailVerified: boolean }): Promise<InvestorUser> {
    const now = new Date();
    const user: InvestorUser = {
      id: randomUUID(),
      email: input.email.toLowerCase(),
      fullName: input.fullName,
      googleId: input.googleId,
      profilePicture: input.profilePicture,
      emailVerified: input.emailVerified,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    this.users.set(user.id, user);
    return user;
  }

  async updateUser(id: string, patch: Partial<InvestorUser>): Promise<InvestorUser> {
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
}
