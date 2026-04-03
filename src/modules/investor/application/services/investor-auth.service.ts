import { JwtTokenService } from '../../../../shared/auth/jwt-token.service';
import { OAuth2Client } from 'google-auth-library';
import * as bcrypt from 'bcryptjs';
import { InvestorAuthUseCasePort } from '../../../../core/ports/inbound/investor-auth.usecase.port';
import { InvestorAuthRepositoryPort } from '../../../../core/ports/outbound/investor-auth.repository.port';
import {
  GoogleAuthRequestDto,
  LoginRequestDto,
  RefreshTokenRequestDto,
  RegisterRequestDto,
  ResetPasswordRequestDto,
  ValidateEmailRequestDto,
  VerifyEmailRequestDto,
  VerifyForgotPasswordCodeDto,
} from '../dtos/auth.dto';
import { AuthResponse, AuthUserPayload, ValidateEmailResponse } from '../models/auth-response.model';
import { HttpError } from '../../../../shared/errors/http-error';
import { emailAdapter } from '../../../../shared/notifications/email.adapter';
import * as crypto from 'crypto';

export class InvestorAuthService implements InvestorAuthUseCasePort {
  private readonly googleClient: OAuth2Client;
  private readonly usedCodes = new Set<string>();
  private readonly inFlightPasswordResetEmails = new Set<string>();
  private readonly inFlightVerificationEmails = new Set<string>();

  constructor(private readonly repository: InvestorAuthRepositoryPort, private readonly jwtTokenService: JwtTokenService) {
    this.googleClient = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI,
    );
  }

  async register(input: RegisterRequestDto): Promise<AuthResponse> {
    if (input.password !== input.confirmPassword) {
      throw new HttpError(400, 'Passwords do not match');
    }

    const existingUser = await this.repository.findByEmail(input.email);
    if (existingUser) {
      throw new HttpError(409, 'User already exists with this email');
    }

    const passwordHash = await bcrypt.hash(input.password, Number(process.env.BCRYPT_SALT_ROUNDS || 12));
    const user = await this.repository.createLocalUser({
      email: input.email.toLowerCase(),
      fullName: input.fullName,
      password: passwordHash,
    });

    // Automatically trigger the email verification code dispatch
    await this.sendEmailVerification(user.email);

    const tokens = this.jwtTokenService.generateTokens(user.id, user.email);
    return this.buildAuthResponse(user, tokens);
  }

  async login(input: LoginRequestDto): Promise<AuthResponse> {
    const user = await this.repository.findByEmail(input.email);

    if (!user || !user.passwordHash) {
      throw new HttpError(401, 'Invalid email');
    }

    const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new HttpError(401, 'Invalid email or password');
    }

    if (!user.isActive) {
      throw new HttpError(401, 'Account is deactivated');
    }

    const updatedUser = await this.repository.updateUser(user.id, { lastLoginAt: new Date() });
    const tokens = this.jwtTokenService.generateTokens(updatedUser.id, updatedUser.email);

    return this.buildAuthResponse(updatedUser, tokens);
  }

  async validateEmail(input: ValidateEmailRequestDto): Promise<ValidateEmailResponse> {
    const email = input.email.toLowerCase();
    const user = await this.repository.findByEmail(email);

    if (input.mode === 'signup') {
      if (user) {
        throw new HttpError(409, 'Email is already exist');
      }

      return {
        success: true,
        message: 'Email is available',
        email,
      };
    }

    if (!user) {
      throw new HttpError(401, 'Email not found');
    }

    if (!input.password) {
      return {
        success: true,
        message: 'Email exists, enter password',
        email,
      };
    }

    if (!user.passwordHash) {
      throw new HttpError(401, 'This account does not support password sign in');
    }

    const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new HttpError(401, 'Invalid password');
    }

    return {
      success: true,
      message: 'Login successful',
      email,
    };
  }

  async googleAuth(input: GoogleAuthRequestDto): Promise<AuthResponse> {
    if (this.usedCodes.has(input.code)) {
      throw new HttpError(400, 'Authorization code has already been used');
    }

    this.usedCodes.add(input.code);
    const cleanupTimeout = setTimeout(() => this.usedCodes.delete(input.code), 10 * 60 * 1000);
    cleanupTimeout.unref();

    let googleEmail: string | null = null;

    try {
      const { tokens } = await this.googleClient.getToken(input.code);
      if (!tokens.id_token) {
        throw new HttpError(400, 'No ID token received from Google');
      }

      this.googleClient.setCredentials(tokens);

      const ticket = await this.googleClient.verifyIdToken({
        idToken: tokens.id_token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      if (!payload?.email) {
        throw new HttpError(400, 'Invalid Google token payload');
      }

      googleEmail = payload.email.toLowerCase();

      let user = await this.repository.findByEmail(googleEmail);

      if (!user) {
        user = await this.repository.createGoogleUser({
          email: googleEmail,
          fullName: payload.name || payload.email,
          googleId: payload.sub,
          profilePicture: payload.picture,
          emailVerified: payload.email_verified ?? false,
        });
      } else if (!user.googleId) {
        user = await this.repository.updateUser(user.id, {
          googleId: payload.sub,
          profilePicture: payload.picture ?? user.profilePicture,
          emailVerified: payload.email_verified ?? user.emailVerified,
        });
      }

      if (!user.isActive) {
        throw new HttpError(401, 'Account is deactivated');
      }

      const updatedUser = await this.repository.updateUser(user.id, { lastLoginAt: new Date() });
      const jwtTokens = this.jwtTokenService.generateTokens(updatedUser.id, updatedUser.email);
      return this.buildAuthResponse(updatedUser, jwtTokens);
    } catch (error: any) {
      this.usedCodes.delete(input.code);

      if (error instanceof HttpError) {
        throw error;
      }

      if (String(error?.message || '').includes('invalid_grant')) {
        throw new HttpError(400, 'Invalid or expired authorization code. Please try signing in again.');
      }

      if (error?.code === 'P2002' && googleEmail) {
        const existingUser = await this.repository.findByEmail(googleEmail);
        if (existingUser) {
          const tokens = this.jwtTokenService.generateTokens(existingUser.id, existingUser.email);
          return this.buildAuthResponse(existingUser, tokens);
        }
      }

      throw new HttpError(400, `Google authentication failed: ${error?.message ?? 'unknown error'}`);
    }
  }

  async getGoogleAuthUrl(): Promise<string> {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) {
      throw new HttpError(400, 'Google OAuth env vars are not configured');
    }

    return this.googleClient.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: true,
      scope: [
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email',
        'openid',
      ],
    });
  }

  async refreshToken(input: RefreshTokenRequestDto): Promise<{ accessToken: string; refreshToken: string }> {
    if (!input.refreshToken) {
      throw new HttpError(400, 'Refresh token is required');
    }

    const decoded = this.jwtTokenService.verifyToken(input.refreshToken);

    if (decoded.type !== 'refresh') {
      throw new HttpError(401, 'Invalid refresh token');
    }

    const user = await this.repository.findById(decoded.userId);
    if (!user || !user.isActive) {
      throw new HttpError(401, 'User account not found or deactivated');
    }

    return this.jwtTokenService.generateTokens(user.id, user.email);
  }

  async me(userId: number): Promise<AuthUserPayload> {
    const user = await this.repository.findById(userId);
    if (!user || !user.isActive) {
      throw new HttpError(401, 'User account not found or deactivated');
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      profilePicture: user.profilePicture,
      emailVerified: user.emailVerified,
      kycStatus: user.kycStatus,
    };
  }

  private generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async sendPasswordResetEmail(email: string): Promise<void> {
    const normalizedEmail = email.toLowerCase();
    if (this.inFlightPasswordResetEmails.has(normalizedEmail)) {
      return;
    }

    this.inFlightPasswordResetEmails.add(normalizedEmail);
    try {
      const user = await this.repository.findByEmail(normalizedEmail);
      if (!user) {
        throw new HttpError(404, 'No account found with this email');
      }

      // Guard against duplicate requests by not re-sending while a code is still active.
      if (user.forgotPasswordCode && user.forgotPasswordExpires && user.forgotPasswordExpires > new Date()) {
        return;
      }

      const code = this.generateCode();
      const expires = new Date();
      expires.setMinutes(expires.getMinutes() + 15);

      const issued = await this.repository.setForgotPasswordCodeIfNotActive(user.id, code, expires);
      if (!issued) {
        return;
      }

      await emailAdapter.sendEmail({
        to: normalizedEmail,
        subject: 'Password Reset Code - ShivAI',
        text: `Your password reset code is: ${code}\nThis code will expire in 15 minutes.`,
        html: `
          <div style="font-family: sans-serif; padding: 20px;">
            <h2>Password Reset Request</h2>
            <p>We received a request to reset your password. Use the code below to proceed:</p>
            <h1 style="color: #4F46E5; letter-spacing: 2px; padding: 10px; background: #f3f4f6; display: inline-block; border-radius: 4px;">${code}</h1>
            <p>This code will expire in 15 minutes.</p>
            <p>If you didn't request this, you can safely ignore this email.</p>
          </div>
        `
      });
    } finally {
      this.inFlightPasswordResetEmails.delete(normalizedEmail);
    }
  }

  async verifyForgotPasswordCode(input: VerifyForgotPasswordCodeDto): Promise<{ success: boolean; message: string }> {
    const user = await this.repository.findByEmail(input.email.toLowerCase());

    if (!user || user.forgotPasswordCode !== input.code) {
      throw new HttpError(400, 'Invalid verification code');
    }

    if (!user.forgotPasswordExpires || user.forgotPasswordExpires < new Date()) {
      throw new HttpError(400, 'Verification code has expired');
    }

    return { success: true, message: 'Code is valid' };
  }

  async resetPassword(input: ResetPasswordRequestDto): Promise<void> {
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
    
    await this.repository.updateUser(user.id, { 
      passwordHash,
      emailVerified: true, // Implicitly verify email on successful reset
      forgotPasswordCode: null as any,
      forgotPasswordExpires: null as any,
    });
  }

  async sendEmailVerification(email: string): Promise<void> {
    const normalizedEmail = email.toLowerCase();
    if (this.inFlightVerificationEmails.has(normalizedEmail)) {
      return;
    }

    this.inFlightVerificationEmails.add(normalizedEmail);
    try {
      const user = await this.repository.findByEmail(normalizedEmail);
      if (!user) {
        throw new HttpError(404, 'No account found with this email');
      }

      if (user.emailVerified) {
        throw new HttpError(400, 'Email is already verified');
      }

      // Guard against duplicate requests by not re-sending while a code is still active.
      if (user.emailVerificationCode && user.emailVerificationExpires && user.emailVerificationExpires > new Date()) {
        return;
      }

      const code = this.generateCode();
      const expires = new Date();
      expires.setMinutes(expires.getMinutes() + 15);

      const issued = await this.repository.setEmailVerificationCodeIfNotActive(user.id, code, expires);
      if (!issued) {
        return;
      }

      await emailAdapter.sendEmail({
        to: normalizedEmail,
        subject: 'Verify Your Email - ShivAI',
        text: `Your email verification code is: ${code}\nThis code will expire in 15 minutes.`,
        html: `
          <div style="font-family: sans-serif; padding: 20px;">
            <h2>Welcome to ShivAI!</h2>
            <p>Please use the verification code below to confirm your email address:</p>
            <h1 style="color: #10B981; letter-spacing: 2px; padding: 10px; background: #f3f4f6; display: inline-block; border-radius: 4px;">${code}</h1>
            <p>This code will expire in 15 minutes.</p>
          </div>
        `
      });
    } finally {
      this.inFlightVerificationEmails.delete(normalizedEmail);
    }
  }

  async verifyEmail(input: VerifyEmailRequestDto): Promise<{ success: boolean; message: string }> {
    const user = await this.repository.findByEmail(input.email.toLowerCase());

    if (!user) {
      throw new HttpError(404, 'No account found with this email');
    }

    if (user.emailVerified) {
      return { success: true, message: 'Email already verified' };
    }

    if (user.emailVerificationCode !== input.code) {
      throw new HttpError(400, 'Invalid verification code');
    }

    if (!user.emailVerificationExpires || user.emailVerificationExpires < new Date()) {
      throw new HttpError(400, 'Verification code has expired');
    }

    await this.repository.updateUser(user.id, {
      emailVerified: true,
      emailVerificationCode: null as any,
      emailVerificationExpires: null as any,
    });

    return { success: true, message: 'Email verified successfully' };
  }

  private buildAuthResponse(
    user: {
      id: number;
      email: string;
      fullName: string;
      profilePicture?: string;
      emailVerified: boolean;
      kycStatus: string;
    },
    tokens: { accessToken: string; refreshToken: string },
  ): AuthResponse {
    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        profilePicture: user.profilePicture,
        emailVerified: user.emailVerified,
        kycStatus: user.kycStatus,
      },
      tokens,
      codeVerified: false,
    };
  }
}
