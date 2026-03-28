import { NextFunction, Request, Response } from 'express';
import { HttpError } from '../../shared/errors/http-error';

export const notFoundHandler = (_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    statusCode: 404,
    message: 'Route not found',
  });
};

export const errorHandler = (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof HttpError) {
    res.status(error.statusCode).json({
      success: false,
      statusCode: error.statusCode,
      message: error.message,
    });
    return;
  }

  const message = error instanceof Error ? error.message : 'Internal server error';
  res.status(500).json({
    success: false,
    statusCode: 500,
    message,
  });
};
