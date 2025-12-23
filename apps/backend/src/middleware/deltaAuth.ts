/**
 * Delta Sharing Protocol Authentication Middleware
 * 
 * This middleware implements the standard Delta Sharing authentication
 * using bearer tokens directly (no JWT exchange). This allows the
 * Delta Sharing endpoints to work with any Delta Sharing client.
 */

import { Request, Response, NextFunction } from 'express';
import { recipientService } from '../services/recipientService.js';
import { createError } from './errorHandler.js';

export interface DeltaAuthenticatedRequest extends Request {
  recipient?: {
    id: string;
    name: string;
  };
}

/**
 * Authenticate requests using the Delta Sharing bearer token directly.
 * This follows the official Delta Sharing protocol where the bearer token
 * from the credential file is used directly in the Authorization header.
 */
export async function deltaAuth(
  req: DeltaAuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      throw createError('Authorization header required', 401);
    }

    // Extract bearer token
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
      throw createError('Invalid authorization format. Use: Bearer <token>', 401);
    }

    const bearerToken = parts[1];

    // Validate the bearer token directly against our database
    const recipient = await recipientService.validateToken(bearerToken);
    
    if (!recipient) {
      throw createError('Invalid or expired token', 401);
    }

    // Attach recipient info to request
    req.recipient = {
      id: recipient.id,
      name: recipient.name,
    };

    next();
  } catch (error) {
    next(error);
  }
}














