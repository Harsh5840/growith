import { JwtTokenService } from '../../../../shared/auth/jwt-token.service';
import * as bcrypt from 'bcryptjs';
import { AdminAuthRepositoryPort } from '../../core/ports/outbound/admin-auth.repository.port';
import {
  AdminLoginRequestDto,
  AdminRegisterRequestDto,
  AdminAuthResponse,
  AdminForgotPasswordDto,
  AdminResetPasswordDto,
  AdminCreateUserDto,
  AdminUpdateUserStatusDto,
  AdminListUsersQueryDto,
} from '../dtos/admin-auth.dto';
import { HttpError } from '../../../../shared/errors/http-error';
import { InvestorAuthUser } from '@prisma/client';
import { emailAdapter } from '../../../../shared/notifications/email.adapter';

export class AdminAuthService {
  constructor(
    private readonly repository: AdminAuthRepositoryPort,
    private readonly jwtTokenService: JwtTokenService
  ) {}

  async register(input: AdminRegisterRequestDto): Promise<AdminAuthResponse> {
    const adminSecret = process.env.ADMIN_REGISTRATION_SECRET || 'fallback-secret-123';
    
    // Simplistic check to ensure not just anyone can register as admin
    if (input.adminRegistrationSecret !== adminSecret) {
      throw new HttpError(403, 'Invalid admin registration secret');
    }

    const existingUser = await this.repository.findByEmail(input.email);
    if (existingUser) {
      throw new HttpError(409, 'Admin user already exists with this email');
    }

    const passwordHash = await bcrypt.hash(input.password, Number(process.env.BCRYPT_SALT_ROUNDS || 12));
    const user = await this.repository.createAdmin({
      email: input.email.toLowerCase(),
      fullName: input.fullName,
      passwordHash,
    });

    const tokens = this.jwtTokenService.generateTokens(user.id, user.email, 'admin');
    return this.buildAuthResponse(user, tokens);
  }

  async login(input: AdminLoginRequestDto): Promise<AdminAuthResponse> {
    const user = await this.repository.findByEmail(input.email);

    if (!user) {
      throw new HttpError(401, 'Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new HttpError(401, 'Invalid email or password');
    }

    if (!user.isActive) {
      throw new HttpError(401, 'Admin account is deactivated');
    }

    const tokens = this.jwtTokenService.generateTokens(user.id, user.email, 'admin');
    return this.buildAuthResponse(user, tokens);
  }

  async me(userId: string) {
    const user = await this.repository.findById(userId);
    if (!user || !user.isActive) {
      throw new HttpError(401, 'Admin account not found or deactivated');
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
    };
  }

  private generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async forgotPassword(input: AdminForgotPasswordDto): Promise<void> {
    const user = await this.repository.findByEmail(input.email.toLowerCase());
    if (!user) {
      throw new HttpError(404, 'No admin account found with this email');
    }

    const code = this.generateCode();
    const expires = new Date();
    expires.setMinutes(expires.getMinutes() + 15);

    await this.repository.updateAdmin(user.id, {
      forgotPasswordCode: code,
      forgotPasswordExpires: expires,
    });

    await emailAdapter.sendEmail({
      to: user.email,
      subject: 'Admin Password Reset Code',
      text: `Your admin password reset code is: ${code}\nThis code will expire in 15 minutes.`,
      html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h2>Admin Password Reset Request</h2>
          <p>We received a request to reset your admin password. Use the code below to proceed:</p>
          <h1 style="color: #ef4444; letter-spacing: 2px; padding: 10px; background: #fee2e2; display: inline-block; border-radius: 4px;">${code}</h1>
          <p>This code will expire in 15 minutes.</p>
        </div>
      `,
    });
  }

  async resetPassword(input: AdminResetPasswordDto): Promise<void> {
    if (input.newPassword !== input.confirmPassword) {
      throw new HttpError(400, 'Passwords do not match');
    }

    const user = await this.repository.findByEmail(input.email.toLowerCase());

    if (!user || user.forgotPasswordCode !== input.code) {
      throw new HttpError(400, 'Invalid or expired reset code');
    }

    if (!user.forgotPasswordExpires || user.forgotPasswordExpires < new Date()) {
      throw new HttpError(400, 'Reset code has expired');
    }

    const passwordHash = await bcrypt.hash(input.newPassword, Number(process.env.BCRYPT_SALT_ROUNDS || 12));
    
    await this.repository.updateAdmin(user.id, { 
      passwordHash,
      forgotPasswordCode: null as any,
      forgotPasswordExpires: null as any,
    });
  }

  async listUsers(query: AdminListUsersQueryDto): Promise<Partial<InvestorAuthUser>[]> {
    return this.repository.listAllInvestors(query.search, query.kycStatus);
  }

  async getUserById(id: string): Promise<Partial<InvestorAuthUser>> {
    const user = await this.repository.findInvestorById(id);
    if (!user) {
      throw new HttpError(404, 'User not found');
    }
    const { passwordHash, forgotPasswordCode, emailVerificationCode, ...safeUser } = user;
    return safeUser as Partial<InvestorAuthUser>;
  }

  async createUser(input: AdminCreateUserDto): Promise<Partial<InvestorAuthUser>> {
    const normalizedEmail = input.email.toLowerCase();
    const existingUser = await this.repository.findInvestorByEmail(normalizedEmail);
    if (existingUser) {
      throw new HttpError(409, 'User already exists with this email');
    }

    // Since admin is creating, bypass email setup and verify email
    const passwordToUse = input.password || Math.random().toString(36).slice(-8);
    const passwordHash = await bcrypt.hash(passwordToUse, Number(process.env.BCRYPT_SALT_ROUNDS || 12));
    
    const user = await this.repository.createInvestor({
      email: normalizedEmail,
      fullName: input.fullName,
      passwordHash,
      emailVerified: true // By-pass email verification sending logic completely
    });

    const { passwordHash: _1, forgotPasswordCode: _2, emailVerificationCode: _3, ...safeUser } = user;
    return safeUser as Partial<InvestorAuthUser>;
  }

  async toggleUserStatus(id: string, input: AdminUpdateUserStatusDto): Promise<void> {
    const user = await this.repository.findInvestorById(id);
    if (!user) {
      throw new HttpError(404, 'User not found');
    }

    await this.repository.updateInvestor(id, { isActive: input.isActive });
  }

  async deleteUser(id: string): Promise<void> {
    const user = await this.repository.findInvestorById(id);
    if (!user) {
      throw new HttpError(404, 'User not found');
    }

    await this.repository.deleteInvestor(id);
  }

  private buildAuthResponse(
    user: { id: string; email: string; fullName: string },
    tokens: { accessToken: string; refreshToken: string },
  ): AdminAuthResponse {
    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
      },
      tokens,
    };
  }
}
