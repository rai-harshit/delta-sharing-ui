/**
 * Security Middleware
 * 
 * Provides additional security measures including:
 * - CSRF protection for state-changing operations
 * - Account lockout after failed login attempts
 * - Security headers enhancement
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { prisma } from '../db/client.js';
import { createError } from './errorHandler.js';
import { cache } from '../cache/redis.js';

// ============================================
// CSRF Protection (Redis-backed for clustering)
// ============================================

const CSRF_TOKEN_HEADER = 'x-csrf-token';
const CSRF_TOKEN_LENGTH = 32;
const CSRF_TTL_SECONDS = 24 * 60 * 60; // 24 hours

/**
 * Generate a CSRF token for a session
 * Uses Redis for distributed storage across multiple pods
 */
export async function generateCsrfToken(sessionId: string): Promise<string> {
  const token = crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
  await cache.set(`csrf:${sessionId}`, token, { ttl: CSRF_TTL_SECONDS });
  return token;
}

/**
 * Validate a CSRF token
 * Uses Redis for distributed validation across multiple pods
 */
export async function validateCsrfToken(sessionId: string, token: string): Promise<boolean> {
  const stored = await cache.get(`csrf:${sessionId}`);
  if (!stored) return false;
  
  try {
    return crypto.timingSafeEqual(
      Buffer.from(stored),
      Buffer.from(token)
    );
  } catch {
    // Lengths don't match
    return false;
  }
}

/**
 * CSRF protection middleware
 * Validates CSRF token for state-changing requests (POST, PUT, DELETE, PATCH)
 */
export async function csrfProtection(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Skip CSRF check for safe methods
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  // Skip CSRF for API endpoints that use Bearer token auth (legacy support)
  // Note: With HttpOnly cookies, we now require CSRF for cookie-based auth
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return next();
  }

  // For cookie-based sessions, require CSRF token
  const sessionId = req.cookies?.sessionId || req.cookies?.token;
  const csrfToken = req.headers[CSRF_TOKEN_HEADER] as string;

  if (!sessionId || !csrfToken) {
    return next(createError('CSRF token required', 403));
  }

  try {
    const isValid = await validateCsrfToken(sessionId, csrfToken);
    if (!isValid) {
      return next(createError('Invalid CSRF token', 403));
    }
    next();
  } catch (error) {
    return next(createError('CSRF validation error', 500));
  }
}

// ============================================
// Account Lockout
// ============================================

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Check if an account is locked
 */
export async function isAccountLocked(email: string): Promise<{
  locked: boolean;
  remainingMs?: number;
}> {
  const user = await prisma.adminUser.findUnique({
    where: { email },
    select: { lockedUntil: true, failedLoginAttempts: true },
  });

  if (!user) {
    return { locked: false };
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return {
      locked: true,
      remainingMs: user.lockedUntil.getTime() - Date.now(),
    };
  }

  return { locked: false };
}

/**
 * Record a failed login attempt
 * Returns true if account is now locked
 */
export async function recordFailedLogin(email: string): Promise<boolean> {
  const user = await prisma.adminUser.findUnique({
    where: { email },
    select: { id: true, failedLoginAttempts: true },
  });

  if (!user) {
    return false;
  }

  const newAttempts = user.failedLoginAttempts + 1;
  const shouldLock = newAttempts >= MAX_FAILED_ATTEMPTS;

  await prisma.adminUser.update({
    where: { id: user.id },
    data: {
      failedLoginAttempts: newAttempts,
      lockedUntil: shouldLock 
        ? new Date(Date.now() + LOCKOUT_DURATION_MS) 
        : null,
    },
  });

  return shouldLock;
}

/**
 * Reset failed login attempts on successful login
 */
export async function resetFailedLogins(email: string): Promise<void> {
  await prisma.adminUser.updateMany({
    where: { email },
    data: {
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
    },
  });
}

/**
 * Middleware to check account lockout before login
 */
export function checkAccountLockout(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const email = req.body?.email;
  
  if (!email) {
    return next();
  }

  isAccountLocked(email).then(({ locked, remainingMs }) => {
    if (locked) {
      const remainingMinutes = Math.ceil((remainingMs || 0) / 60000);
      return next(
        createError(
          `Account is temporarily locked. Try again in ${remainingMinutes} minutes.`,
          429
        )
      );
    }
    next();
  }).catch(next);
}

// ============================================
// Additional Security Headers
// ============================================

/**
 * Enhanced security headers middleware
 * Supplements helmet with additional headers
 */
export function enhancedSecurityHeaders(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Prevent browsers from MIME-sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // XSS protection (legacy, but still useful for older browsers)
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions policy (restrict browser features)
  res.setHeader(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=(), payment=()'
  );

  // Cache control for sensitive responses
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }

  next();
}

// ============================================
// Input Validation Helpers
// ============================================

/**
 * Validate password strength
 */
export function validatePasswordStrength(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

