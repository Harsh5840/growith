import jwt, { SignOptions } from 'jsonwebtoken';
import { HttpError } from '@shared/errors/http-error';

export interface JwtPayload {
  userId: string;
  email: string;
  type: 'access' | 'refresh';
}

export class JwtTokenService {
  generateTokens(userId: string, email: string): { accessToken: string; refreshToken: string } {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new HttpError(500, 'JWT_SECRET is not configured');
    }

    const accessPayload: JwtPayload = { userId, email, type: 'access' };
    const refreshPayload: JwtPayload = { userId, email, type: 'refresh' };

    const accessOptions: SignOptions = {
      expiresIn: (process.env.JWT_ACCESS_EXPIRY || '15m') as SignOptions['expiresIn'],
    };
    const accessToken = jwt.sign(accessPayload, jwtSecret, accessOptions);

    const refreshOptions: SignOptions = {
      expiresIn: (process.env.JWT_REFRESH_EXPIRY || '7d') as SignOptions['expiresIn'],
    };
    const refreshToken = jwt.sign(refreshPayload, jwtSecret, refreshOptions);

    return { accessToken, refreshToken };
  }

  verifyToken(token: string): JwtPayload {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new HttpError(500, 'JWT_SECRET is not configured');
    }

    try {
      return jwt.verify(token, jwtSecret) as JwtPayload;
    } catch {
      throw new HttpError(401, 'Invalid token');
    }
  }
}
