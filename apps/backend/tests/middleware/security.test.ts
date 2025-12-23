/**
 * Security Middleware Tests
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import {
  generateCsrfToken,
  validateCsrfToken,
  enhancedSecurityHeaders,
  validatePasswordStrength,
} from '../../src/middleware/security.js';

// Mock response
const mockResponse = () => {
  const res: Partial<Response> = {
    setHeader: jest.fn(),
  };
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
};

const mockNext: NextFunction = jest.fn();

describe('Security Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('CSRF Token Management', () => {
    it('should generate a CSRF token', async () => {
      const sessionId = 'test-session-123';
      const token = await generateCsrfToken(sessionId);
      
      expect(token).toBeDefined();
      expect(token.length).toBe(64); // 32 bytes = 64 hex chars
    });

    it('should validate a correct CSRF token', async () => {
      const sessionId = 'test-session-456';
      const token = await generateCsrfToken(sessionId);
      
      const isValid = await validateCsrfToken(sessionId, token);
      expect(isValid).toBe(true);
    });

    it('should reject an incorrect CSRF token', async () => {
      const sessionId = 'test-session-789';
      await generateCsrfToken(sessionId);
      
      const isValid = await validateCsrfToken(sessionId, 'wrong-token');
      expect(isValid).toBe(false);
    });

    it('should reject token for non-existent session', async () => {
      const isValid = await validateCsrfToken('non-existent', 'some-token');
      expect(isValid).toBe(false);
    });

    it('should generate unique tokens for different sessions', async () => {
      const token1 = await generateCsrfToken('session-1');
      const token2 = await generateCsrfToken('session-2');
      
      expect(token1).not.toBe(token2);
    });
  });

  describe('Enhanced Security Headers', () => {
    it('should set security headers', () => {
      const req = { path: '/api/test' } as Request;
      const res = mockResponse();

      enhancedSecurityHeaders(req, res, mockNext);

      expect(res.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
      expect(res.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
      expect(res.setHeader).toHaveBeenCalledWith('X-XSS-Protection', '1; mode=block');
      expect(res.setHeader).toHaveBeenCalledWith('Referrer-Policy', 'strict-origin-when-cross-origin');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should set cache-control for API endpoints', () => {
      const req = { path: '/api/shares' } as Request;
      const res = mockResponse();

      enhancedSecurityHeaders(req, res, mockNext);

      expect(res.setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        'no-store, no-cache, must-revalidate, proxy-revalidate'
      );
      expect(res.setHeader).toHaveBeenCalledWith('Pragma', 'no-cache');
      expect(res.setHeader).toHaveBeenCalledWith('Expires', '0');
    });

    it('should not set cache-control for non-API endpoints', () => {
      const req = { path: '/static/app.js' } as Request;
      const res = mockResponse();

      enhancedSecurityHeaders(req, res, mockNext);

      // Cache-Control should not be called with the specific value for non-API paths
      const calls = (res.setHeader as jest.Mock).mock.calls;
      const cacheControlCall = calls.find(
        (call: string[]) => call[0] === 'Cache-Control' && call[1].includes('no-store')
      );
      expect(cacheControlCall).toBeUndefined();
    });
  });

  describe('Password Strength Validation', () => {
    it('should accept strong passwords', () => {
      const result = validatePasswordStrength('StrongPass123');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject short passwords', () => {
      const result = validatePasswordStrength('Short1');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters long');
    });

    it('should require uppercase letters', () => {
      const result = validatePasswordStrength('lowercase123');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
    });

    it('should require lowercase letters', () => {
      const result = validatePasswordStrength('UPPERCASE123');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one lowercase letter');
    });

    it('should require numbers', () => {
      const result = validatePasswordStrength('NoNumbers');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one number');
    });

    it('should report multiple errors', () => {
      const result = validatePasswordStrength('weak');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });
});

