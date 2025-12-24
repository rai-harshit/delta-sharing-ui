/**
 * Rate Limiting Middleware
 * 
 * Protects API from abuse with configurable rate limits.
 * Uses Redis for distributed rate limiting in production (falls back to in-memory).
 */

import { Request, Response, NextFunction } from 'express';
import { checkRateLimit as cacheRateLimit, getRateLimitStatus } from '../cache/redis.js';
import { logger } from '../utils/logger.js';

interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Max requests per window
  message?: string;      // Custom error message
  keyGenerator?: (req: Request) => string;  // Custom key generator
  skipFailedRequests?: boolean;  // Don't count failed requests
  skipSuccessfulRequests?: boolean;  // Don't count successful requests
}

/**
 * Default key generator - uses IP address
 */
function defaultKeyGenerator(req: Request): string {
  return req.ip || req.socket.remoteAddress || 'unknown';
}

/**
 * Create a rate limiter middleware with specified config
 * Uses Redis for distributed rate limiting across multiple pods
 */
export function rateLimit(config: RateLimitConfig) {
  const {
    windowMs,
    maxRequests,
    message = 'Too many requests, please try again later.',
    keyGenerator = defaultKeyGenerator,
    skipFailedRequests = false,
    skipSuccessfulRequests = false,
  } = config;

  const windowSeconds = Math.ceil(windowMs / 1000);

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const key = keyGenerator(req);
      
      // For skip options, we need to handle counting after response
      if (skipFailedRequests || skipSuccessfulRequests) {
        // Check current count WITHOUT incrementing (uses same key)
        const result = await getRateLimitStatus(key, maxRequests, windowSeconds);
        
        // Set headers
        res.set('X-RateLimit-Limit', String(maxRequests));
        res.set('X-RateLimit-Remaining', String(result.remaining));
        res.set('X-RateLimit-Reset', String(Math.ceil(result.resetAt.getTime() / 1000)));
        
        if (!result.allowed) {
          const retryAfter = Math.ceil((result.resetAt.getTime() - Date.now()) / 1000);
          res.set('Retry-After', String(retryAfter));
          return res.status(429).json({
            error: message,
            retryAfter,
          });
        }
        
        // Increment after response based on status (uses same key)
        res.on('finish', async () => {
          const shouldSkip = 
            (skipFailedRequests && res.statusCode >= 400) ||
            (skipSuccessfulRequests && res.statusCode < 400);
          
          if (!shouldSkip) {
            await cacheRateLimit(key, maxRequests, windowSeconds);
          }
        });
        
        return next();
      }
      
      // Standard rate limiting - check and increment
      const result = await cacheRateLimit(key, maxRequests, windowSeconds);
      
      // Set rate limit headers
      res.set('X-RateLimit-Limit', String(maxRequests));
      res.set('X-RateLimit-Remaining', String(result.remaining));
      res.set('X-RateLimit-Reset', String(Math.ceil(result.resetAt.getTime() / 1000)));
      
      if (!result.allowed) {
        const retryAfter = Math.ceil((result.resetAt.getTime() - Date.now()) / 1000);
        res.set('Retry-After', String(retryAfter));
        return res.status(429).json({
          error: message,
          retryAfter,
        });
      }
      
      next();
    } catch (error) {
      // If rate limiting fails, allow the request but log the error
      logger.error('Rate limiting error', error);
      next();
    }
  };
}

/**
 * Pre-configured rate limiters for different use cases
 */

// Check if we're in development or test mode
const isDev = process.env.NODE_ENV !== 'production';
const isTest = process.env.NODE_ENV === 'test';

// In test mode, use very high limits to avoid rate limiting during E2E tests
const testMultiplier = isTest ? 100 : 1;

// Standard API rate limit: 100 requests per minute (500 in dev, 50000 in test)
export const apiRateLimit = rateLimit({
  windowMs: 60 * 1000,
  maxRequests: (isDev ? 500 : 100) * testMultiplier,
  message: 'Too many API requests. Please slow down.',
});

// Auth rate limit: 10 login attempts per 15 minutes (50 in dev, 5000 in test)
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  maxRequests: (isDev ? 50 : 10) * testMultiplier,
  message: 'Too many login attempts. Please try again later.',
  skipSuccessfulRequests: true,  // Only count failed attempts
});

// Delta protocol rate limit: 1000 requests per minute (5000 in dev, 500000 in test)
export const deltaProtocolRateLimit = rateLimit({
  windowMs: 60 * 1000,
  maxRequests: (isDev ? 5000 : 1000) * testMultiplier,
  message: 'Too many data requests. Please slow down.',
});

// Admin operations rate limit: 30 requests per minute (300 in dev, 30000 in test)
export const adminRateLimit = rateLimit({
  windowMs: 60 * 1000,
  maxRequests: (isDev ? 300 : 30) * testMultiplier,
  message: 'Too many admin operations. Please slow down.',
});
