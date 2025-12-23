/**
 * Auth Middleware Tests
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import {
  authenticateToken,
  authenticateAdmin,
  requirePermission,
  requireRole,
  hasPermission,
  getPermissionsForRole,
  Permissions,
  AuthenticatedRequest,
} from '../../src/middleware/auth.js';

// Mock response and next function
const mockResponse = () => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
};

const mockNext: NextFunction = jest.fn();

describe('Auth Middleware', () => {
  const jwtSecret = process.env.JWT_SECRET || 'test-secret';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('authenticateToken', () => {
    it('should authenticate valid admin token', () => {
      const token = jwt.sign(
        { adminId: '123', email: 'admin@test.com', role: 'admin', adminRole: 'admin' },
        jwtSecret,
        { expiresIn: '1h' }
      );

      const req = {
        headers: { authorization: `Bearer ${token}` },
      } as AuthenticatedRequest;
      const res = mockResponse();

      authenticateToken(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(req.user).toBeDefined();
      expect(req.user?.adminId).toBe('123');
      expect(req.user?.email).toBe('admin@test.com');
    });

    it('should authenticate valid recipient token', () => {
      const token = jwt.sign(
        { recipientId: 'rec123', recipientName: 'TestRecipient', role: 'recipient' },
        jwtSecret,
        { expiresIn: '1h' }
      );

      const req = {
        headers: { authorization: `Bearer ${token}` },
      } as AuthenticatedRequest;
      const res = mockResponse();

      authenticateToken(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(req.user?.recipientId).toBe('rec123');
      expect(req.user?.role).toBe('recipient');
    });

    it('should reject missing authorization header', () => {
      const req = { headers: {} } as AuthenticatedRequest;
      const res = mockResponse();

      authenticateToken(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 401 })
      );
    });

    it('should reject invalid token', () => {
      const req = {
        headers: { authorization: 'Bearer invalid-token' },
      } as AuthenticatedRequest;
      const res = mockResponse();

      authenticateToken(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 403 })
      );
    });

    it('should reject expired token', () => {
      const token = jwt.sign(
        { adminId: '123', role: 'admin' },
        jwtSecret,
        { expiresIn: '-1h' } // Already expired
      );

      const req = {
        headers: { authorization: `Bearer ${token}` },
      } as AuthenticatedRequest;
      const res = mockResponse();

      authenticateToken(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 403 })
      );
    });
  });

  describe('authenticateAdmin', () => {
    it('should allow admin role', () => {
      const token = jwt.sign(
        { adminId: '123', role: 'admin', adminRole: 'admin' },
        jwtSecret
      );

      const req = {
        headers: { authorization: `Bearer ${token}` },
      } as AuthenticatedRequest;
      const res = mockResponse();

      authenticateAdmin(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should allow editor role', () => {
      const token = jwt.sign(
        { adminId: '123', role: 'editor', adminRole: 'editor' },
        jwtSecret
      );

      const req = {
        headers: { authorization: `Bearer ${token}` },
      } as AuthenticatedRequest;
      const res = mockResponse();

      authenticateAdmin(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should allow viewer role', () => {
      const token = jwt.sign(
        { adminId: '123', role: 'viewer', adminRole: 'viewer' },
        jwtSecret
      );

      const req = {
        headers: { authorization: `Bearer ${token}` },
      } as AuthenticatedRequest;
      const res = mockResponse();

      authenticateAdmin(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should reject recipient role', () => {
      const token = jwt.sign(
        { recipientId: '123', role: 'recipient' },
        jwtSecret
      );

      const req = {
        headers: { authorization: `Bearer ${token}` },
      } as AuthenticatedRequest;
      const res = mockResponse();

      authenticateAdmin(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 403 })
      );
    });
  });

  describe('requirePermission', () => {
    it('should allow admin with any permission', () => {
      const token = jwt.sign(
        { adminId: '123', role: 'admin', adminRole: 'admin' },
        jwtSecret
      );

      const req = {
        headers: { authorization: `Bearer ${token}` },
      } as AuthenticatedRequest;
      const res = mockResponse();

      const middleware = requirePermission(Permissions.SHARES_DELETE);
      middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should deny editor for delete permission', () => {
      const token = jwt.sign(
        { adminId: '123', role: 'admin', adminRole: 'editor' },
        jwtSecret
      );

      const req = {
        headers: { authorization: `Bearer ${token}` },
      } as AuthenticatedRequest;
      const res = mockResponse();

      const middleware = requirePermission(Permissions.SHARES_DELETE);
      middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 403 })
      );
    });

    it('should allow editor for create permission', () => {
      const token = jwt.sign(
        { adminId: '123', role: 'admin', adminRole: 'editor' },
        jwtSecret
      );

      const req = {
        headers: { authorization: `Bearer ${token}` },
      } as AuthenticatedRequest;
      const res = mockResponse();

      const middleware = requirePermission(Permissions.SHARES_CREATE);
      middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should deny viewer for create permission', () => {
      const token = jwt.sign(
        { adminId: '123', role: 'admin', adminRole: 'viewer' },
        jwtSecret
      );

      const req = {
        headers: { authorization: `Bearer ${token}` },
      } as AuthenticatedRequest;
      const res = mockResponse();

      const middleware = requirePermission(Permissions.SHARES_CREATE);
      middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 403 })
      );
    });

    it('should allow viewer for view permission', () => {
      const token = jwt.sign(
        { adminId: '123', role: 'admin', adminRole: 'viewer' },
        jwtSecret
      );

      const req = {
        headers: { authorization: `Bearer ${token}` },
      } as AuthenticatedRequest;
      const res = mockResponse();

      const middleware = requirePermission(Permissions.SHARES_VIEW);
      middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe('requireRole', () => {
    it('should allow admin when admin is required', () => {
      const token = jwt.sign(
        { adminId: '123', role: 'admin', adminRole: 'admin' },
        jwtSecret
      );

      const req = {
        headers: { authorization: `Bearer ${token}` },
      } as AuthenticatedRequest;
      const res = mockResponse();

      const middleware = requireRole('admin');
      middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should allow admin when editor is required', () => {
      const token = jwt.sign(
        { adminId: '123', role: 'admin', adminRole: 'admin' },
        jwtSecret
      );

      const req = {
        headers: { authorization: `Bearer ${token}` },
      } as AuthenticatedRequest;
      const res = mockResponse();

      const middleware = requireRole('editor');
      middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should deny editor when admin is required', () => {
      const token = jwt.sign(
        { adminId: '123', role: 'admin', adminRole: 'editor' },
        jwtSecret
      );

      const req = {
        headers: { authorization: `Bearer ${token}` },
      } as AuthenticatedRequest;
      const res = mockResponse();

      const middleware = requireRole('admin');
      middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 403 })
      );
    });

    it('should deny viewer when editor is required', () => {
      const token = jwt.sign(
        { adminId: '123', role: 'admin', adminRole: 'viewer' },
        jwtSecret
      );

      const req = {
        headers: { authorization: `Bearer ${token}` },
      } as AuthenticatedRequest;
      const res = mockResponse();

      const middleware = requireRole('editor');
      middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 403 })
      );
    });
  });

  describe('hasPermission', () => {
    it('should return true for admin with any permission', () => {
      expect(hasPermission('admin', Permissions.SHARES_DELETE)).toBe(true);
      expect(hasPermission('admin', Permissions.ADMIN_USERS_DELETE)).toBe(true);
    });

    it('should return true for editor with allowed permissions', () => {
      expect(hasPermission('editor', Permissions.SHARES_CREATE)).toBe(true);
      expect(hasPermission('editor', Permissions.SHARES_EDIT)).toBe(true);
    });

    it('should return false for editor with delete permissions', () => {
      expect(hasPermission('editor', Permissions.SHARES_DELETE)).toBe(false);
      expect(hasPermission('editor', Permissions.RECIPIENTS_DELETE)).toBe(false);
    });

    it('should return true for viewer with view permissions', () => {
      expect(hasPermission('viewer', Permissions.SHARES_VIEW)).toBe(true);
      expect(hasPermission('viewer', Permissions.AUDIT_VIEW)).toBe(true);
    });

    it('should return false for viewer with create/edit/delete permissions', () => {
      expect(hasPermission('viewer', Permissions.SHARES_CREATE)).toBe(false);
      expect(hasPermission('viewer', Permissions.SHARES_EDIT)).toBe(false);
      expect(hasPermission('viewer', Permissions.SHARES_DELETE)).toBe(false);
    });
  });

  describe('getPermissionsForRole', () => {
    it('should return all permissions for admin', () => {
      const permissions = getPermissionsForRole('admin');
      expect(permissions).toContain(Permissions.SHARES_DELETE);
      expect(permissions).toContain(Permissions.ADMIN_USERS_DELETE);
      expect(permissions.length).toBeGreaterThan(15);
    });

    it('should return limited permissions for editor', () => {
      const permissions = getPermissionsForRole('editor');
      expect(permissions).toContain(Permissions.SHARES_CREATE);
      expect(permissions).not.toContain(Permissions.SHARES_DELETE);
      expect(permissions).not.toContain(Permissions.ADMIN_USERS_CREATE);
    });

    it('should return view-only permissions for viewer', () => {
      const permissions = getPermissionsForRole('viewer');
      expect(permissions).toContain(Permissions.SHARES_VIEW);
      expect(permissions).not.toContain(Permissions.SHARES_CREATE);
      expect(permissions.length).toBeLessThan(10);
    });
  });
});


