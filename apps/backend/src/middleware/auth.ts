import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { createError } from './errorHandler.js';
import { logger } from '../utils/logger.js';

/**
 * Get JWT secret from environment - fails if not configured in production
 */
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET environment variable is required in production');
    }
    // Only allow default in development with a warning
    logger.warn('Using default JWT secret - set JWT_SECRET in production!');
    return 'development-only-secret-do-not-use-in-production';
  }
  
  // Validate secret length (at least 32 characters recommended)
  if (secret.length < 32) {
    logger.warn('JWT_SECRET should be at least 32 characters for security');
  }
  
  return secret;
}

// Cache the JWT secret
let jwtSecretCache: string | null = null;
export function getJwtSecretCached(): string {
  if (!jwtSecretCache) {
    jwtSecretCache = getJwtSecret();
  }
  return jwtSecretCache;
}

/**
 * Role-Based Access Control (RBAC) System
 * 
 * Roles:
 * - admin: Full access to all operations
 * - editor: Can create/edit shares, recipients, but cannot delete or manage users
 * - viewer: Read-only access to view shares, recipients, and audit logs
 * - recipient: External data consumer (Delta Sharing protocol access only)
 */

export type AdminRole = 'admin' | 'editor' | 'viewer';
export type UserRole = AdminRole | 'recipient';

/**
 * Permission definitions for each action
 */
export const Permissions = {
  // Share management
  SHARES_VIEW: 'shares:view',
  SHARES_CREATE: 'shares:create',
  SHARES_EDIT: 'shares:edit',
  SHARES_DELETE: 'shares:delete',
  
  // Recipient management
  RECIPIENTS_VIEW: 'recipients:view',
  RECIPIENTS_CREATE: 'recipients:create',
  RECIPIENTS_EDIT: 'recipients:edit',
  RECIPIENTS_DELETE: 'recipients:delete',
  RECIPIENTS_ROTATE_TOKEN: 'recipients:rotate_token',
  
  // Storage configuration
  STORAGE_VIEW: 'storage:view',
  STORAGE_CREATE: 'storage:create',
  STORAGE_EDIT: 'storage:edit',
  STORAGE_DELETE: 'storage:delete',
  
  // Audit logs
  AUDIT_VIEW: 'audit:view',
  AUDIT_EXPORT: 'audit:export',
  AUDIT_CLEANUP: 'audit:cleanup',
  
  // Admin user management
  ADMIN_USERS_VIEW: 'admin_users:view',
  ADMIN_USERS_CREATE: 'admin_users:create',
  ADMIN_USERS_EDIT: 'admin_users:edit',
  ADMIN_USERS_DELETE: 'admin_users:delete',
} as const;

export type Permission = typeof Permissions[keyof typeof Permissions];

/**
 * Role-to-permissions mapping
 */
const rolePermissions: Record<AdminRole, Permission[]> = {
  admin: [
    // Admins have all permissions
    Permissions.SHARES_VIEW,
    Permissions.SHARES_CREATE,
    Permissions.SHARES_EDIT,
    Permissions.SHARES_DELETE,
    Permissions.RECIPIENTS_VIEW,
    Permissions.RECIPIENTS_CREATE,
    Permissions.RECIPIENTS_EDIT,
    Permissions.RECIPIENTS_DELETE,
    Permissions.RECIPIENTS_ROTATE_TOKEN,
    Permissions.STORAGE_VIEW,
    Permissions.STORAGE_CREATE,
    Permissions.STORAGE_EDIT,
    Permissions.STORAGE_DELETE,
    Permissions.AUDIT_VIEW,
    Permissions.AUDIT_EXPORT,
    Permissions.AUDIT_CLEANUP,
    Permissions.ADMIN_USERS_VIEW,
    Permissions.ADMIN_USERS_CREATE,
    Permissions.ADMIN_USERS_EDIT,
    Permissions.ADMIN_USERS_DELETE,
  ],
  editor: [
    // Editors can create and edit, but not delete or manage admin users
    Permissions.SHARES_VIEW,
    Permissions.SHARES_CREATE,
    Permissions.SHARES_EDIT,
    Permissions.RECIPIENTS_VIEW,
    Permissions.RECIPIENTS_CREATE,
    Permissions.RECIPIENTS_EDIT,
    Permissions.RECIPIENTS_ROTATE_TOKEN,
    Permissions.STORAGE_VIEW,
    Permissions.STORAGE_CREATE,
    Permissions.STORAGE_EDIT,
    Permissions.AUDIT_VIEW,
    Permissions.AUDIT_EXPORT,
  ],
  viewer: [
    // Viewers have read-only access
    Permissions.SHARES_VIEW,
    Permissions.RECIPIENTS_VIEW,
    Permissions.STORAGE_VIEW,
    Permissions.AUDIT_VIEW,
  ],
};

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: AdminRole, permission: Permission): boolean {
  return rolePermissions[role]?.includes(permission) ?? false;
}

/**
 * Get all permissions for a role
 */
export function getPermissionsForRole(role: AdminRole): Permission[] {
  return rolePermissions[role] || [];
}

export interface AuthenticatedRequest extends Request {
  user?: {
    // Admin fields
    adminId?: string;
    email?: string;
    name?: string;
    adminRole?: AdminRole;  // Specific admin role (admin, editor, viewer)
    // Recipient fields
    serverUrl?: string;
    token?: string;
    recipientId?: string;
    recipientName?: string;
    // Common
    role: UserRole;
  };
}

export function authenticateToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  // Try cookie first (more secure), then Authorization header for backward compatibility
  const authHeader = req.headers.authorization;
  const token = req.cookies?.token || 
    (authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null);

  if (!token) {
    return next(createError('Authentication required', 401));
  }

  try {
    const jwtSecret = getJwtSecretCached();
    const decoded = jwt.verify(token, jwtSecret) as {
      // Admin fields
      adminId?: string;
      email?: string;
      name?: string;
      adminRole?: AdminRole;
      // Recipient fields
      serverUrl?: string;
      token?: string;
      recipientId?: string;
      recipientName?: string;
      // Common
      role: UserRole;
    };
    
    req.user = decoded;
    next();
  } catch (error) {
    return next(createError('Invalid or expired token', 403));
  }
}

/**
 * Middleware that requires admin authentication (any admin role)
 */
export function authenticateAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  // First authenticate the token
  authenticateToken(req, res, (err) => {
    if (err) {
      return next(err);
    }
    
    // Then check if user is an admin (any admin role)
    if (req.user?.role !== 'admin' && req.user?.role !== 'editor' && req.user?.role !== 'viewer') {
      return next(createError('Admin access required', 403));
    }
    
    next();
  });
}

/**
 * Middleware factory that requires specific permission(s)
 * @param permissions - Single permission or array of permissions (user must have at least one)
 */
export function requirePermission(...permissions: Permission[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // First authenticate
    authenticateToken(req, res, (err) => {
      if (err) {
        return next(err);
      }

      // Recipients don't have admin permissions
      if (req.user?.role === 'recipient') {
        return next(createError('Admin access required', 403));
      }

      // Get the admin role - adminRole from JWT takes precedence
      const adminRole = req.user?.adminRole || (req.user?.role as AdminRole);
      
      if (!adminRole) {
        return next(createError('Invalid user role', 403));
      }

      // Check if user has at least one of the required permissions
      const hasRequiredPermission = permissions.some(p => hasPermission(adminRole, p));

      if (!hasRequiredPermission) {
        return next(createError(`Permission denied. Required: ${permissions.join(' or ')}`, 403));
      }

      next();
    });
  };
}

/**
 * Middleware that requires a specific admin role or higher
 */
export function requireRole(minimumRole: AdminRole) {
  const roleHierarchy: AdminRole[] = ['viewer', 'editor', 'admin'];
  
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    authenticateToken(req, res, (err) => {
      if (err) {
        return next(err);
      }

      if (req.user?.role === 'recipient') {
        return next(createError('Admin access required', 403));
      }

      const adminRole = req.user?.adminRole || (req.user?.role as AdminRole);
      
      if (!adminRole) {
        return next(createError('Invalid user role', 403));
      }

      const userRoleIndex = roleHierarchy.indexOf(adminRole);
      const requiredRoleIndex = roleHierarchy.indexOf(minimumRole);

      if (userRoleIndex < requiredRoleIndex) {
        return next(createError(`Role '${minimumRole}' or higher required`, 403));
      }

      next();
    });
  };
}
