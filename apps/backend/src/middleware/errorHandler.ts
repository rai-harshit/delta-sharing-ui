import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

export interface ApiError extends Error {
  statusCode?: number;
  details?: unknown;
}

export function errorHandler(
  err: ApiError,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  logger.error('Request error', err);
  
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  const errorResponse: Record<string, unknown> = { message };
  
  if (process.env.NODE_ENV === 'development' && err.stack) {
    errorResponse.stack = err.stack;
  }
  
  if (err.details !== undefined) {
    errorResponse.details = err.details;
  }

  res.status(statusCode).json({
    success: false,
    error: errorResponse,
  });
}

export function createError(message: string, statusCode: number, details?: unknown): ApiError {
  const error: ApiError = new Error(message);
  error.statusCode = statusCode;
  error.details = details;
  return error;
}














