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
  ValidateEmailRequestDto,
} from '../dtos/auth.dto';
import { AuthResponse, AuthUserPayload, ValidateEmailResponse } from '../models/auth-response.model';
import { HttpError } from '../../../../shared/errors/http-error';

export class InvestorAuthService implements InvestorAuthUseCasePort {
  private readonly googleClient: OAuth2Client;
  private readonly usedCodes = new Set<string>();

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

  async me(userId: string): Promise<AuthUserPayload> {
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
    };
  }

  async sendPasswordResetEmail(email: string): Promise<void> {
    const user = await this.repository.findByEmail(email.toLowerCase());
    if (!user) {
      throw new HttpError(404, 'No account found with this email');
    }
  }

  async resetPassword(token: string, newPassword: string, confirmPassword: string): Promise<void> {
    if (newPassword !== confirmPassword) {
      throw new HttpError(400, 'Passwords do not match');
    }

    const decoded = this.jwtTokenService.verifyToken(token);
    if (decoded.type !== 'access') {
      throw new HttpError(401, 'Invalid reset token');
    }

    const user = await this.repository.findById(decoded.userId);
    if (!user) {
      throw new HttpError(404, 'User account not found');
    }

    const passwordHash = await bcrypt.hash(newPassword, Number(process.env.BCRYPT_SALT_ROUNDS || 12));
    await this.repository.updateUser(user.id, { passwordHash });
  }

  private buildAuthResponse(
    user: {
      id: string;
      email: string;
      fullName: string;
      profilePicture?: string;
      emailVerified: boolean;
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
      },
      tokens,
      codeVerified: false,
    };
  }
}
