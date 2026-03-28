import { NextFunction, Request, Response } from 'express';
import { JwtTokenService } from './jwt-token.service';
import { AuthRequest } from '../../types/auth-request';
import { HttpError } from '../errors/http-error';

export const createAuthenticate = (jwtTokenService: JwtTokenService) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(new HttpError(401, 'Access token is required'));
    }

    try {
      const token = authHeader.slice(7);
      const payload = jwtTokenService.verifyToken(token);

      if (payload.type !== 'access') {
        return next(new HttpError(401, 'Invalid token type'));
      }

      (req as AuthRequest).user = {
        userId: payload.userId,
        email: payload.email,
      };

      return next();
    } catch (error) {
      return next(error);
    }
  };
};
