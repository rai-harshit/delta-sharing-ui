import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { createError } from '../middleware/errorHandler.js';
import { recipientService } from '../services/recipientService.js';
import { adminService } from '../services/adminService.js';
import { authenticateToken, AuthenticatedRequest, getJwtSecretCached, getPermissionsForRole, AdminRole } from '../middleware/auth.js';
import { 
  checkAccountLockout, 
  recordFailedLogin, 
  resetFailedLogins,
  isAccountLocked,
  generateCsrfToken,
  validatePasswordStrength
} from '../middleware/security.js';
import { webhookService } from '../services/webhookService.js';

const router: Router = Router();

// Admin login schema - allow less strict email for local dev (admin@localhost)
const adminLoginSchema = z.object({
  email: z.string().min(1, 'Email is required').refine(
    (email) => email.includes('@'),
    { message: 'Invalid email format' }
  ),
  password: z.string().min(1, 'Password is required'),
});

// Change password schema
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

// Admin login - for provider console
router.post('/login', checkAccountLockout, async (req, res, next) => {
  try {
    const { email, password } = adminLoginSchema.parse(req.body);
    
    // Check if account is locked
    const lockStatus = await isAccountLocked(email);
    if (lockStatus.locked) {
      const remainingMinutes = Math.ceil((lockStatus.remainingMs || 0) / 60000);
      throw createError(
        `Account is temporarily locked. Try again in ${remainingMinutes} minutes.`,
        429
      );
    }
    
    const admin = await adminService.validateCredentials(email, password);
    
    if (!admin) {
      // Record failed login attempt
      const isNowLocked = await recordFailedLogin(email);
      if (isNowLocked) {
        throw createError(
          'Account has been locked due to too many failed login attempts. Try again in 15 minutes.',
          429
        );
      }
      throw createError('Invalid email or password', 401);
    }

    // Reset failed login attempts on successful login
    await resetFailedLogins(email);

    // Generate JWT token for session
    // The 'role' field indicates admin vs recipient, 'adminRole' is the specific admin role level
    const jwtSecret = getJwtSecretCached();
    const token = jwt.sign(
      { 
        adminId: admin.id,
        email: admin.email,
        name: admin.name,
        role: 'admin',  // User type (admin or recipient)
        adminRole: admin.role,  // Specific admin role (admin, editor, viewer)
      },
      jwtSecret,
      { expiresIn: '24h' }
    );

    // Set HttpOnly cookie for secure token storage
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: '/',
    });

    // Send webhook notification for login
    webhookService.onUserLogin({
      id: admin.id,
      email: admin.email,
      method: 'password',
    }).catch(() => {}); // Silently ignore webhook failures for login

    res.json({
      success: true,
      // Token still returned for backward compatibility with Authorization header
      token,
      user: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        mustChangePassword: admin.mustChangePassword,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, error.errors));
    }
    next(error);
  }
});

// Change password
router.post('/change-password', authenticateToken, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.user?.adminId) {
      throw createError('Admin authentication required', 401);
    }

    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    
    // Validate password strength
    const { valid, errors } = validatePasswordStrength(newPassword);
    if (!valid) {
      throw createError(`Password too weak: ${errors.join(', ')}`, 400);
    }
    
    await adminService.changePassword(authReq.user.adminId, currentPassword, newPassword);

    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, error.errors));
    }
    if (error instanceof Error && error.message === 'Current password is incorrect') {
      return next(createError('Current password is incorrect', 401));
    }
    next(error);
  }
});

// Get current user info with permissions
router.get('/me', authenticateToken, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    
    // Handle admin users
    if (authReq.user?.adminId) {
      const admin = await adminService.getAdmin(authReq.user.adminId);
      if (!admin) {
        throw createError('Admin not found', 404);
      }

      // Get permissions for the admin's role
      const permissions = getPermissionsForRole(admin.role as AdminRole);

      res.json({
        success: true,
        user: admin,
        permissions,
      });
      return;
    }
    
    // Handle recipient users
    if (authReq.user?.recipientId) {
      res.json({
        success: true,
        user: {
          serverUrl: authReq.user.serverUrl,
          recipientId: authReq.user.recipientId,
          recipientName: authReq.user.recipientName,
          role: 'recipient',
        },
        permissions: [], // Recipients have no admin permissions
      });
      return;
    }

    throw createError('Authentication required', 401);
  } catch (error) {
    next(error);
  }
});

// Recipient login - validates bearer token from credential file
router.post('/recipient/login', async (req, res, next) => {
  try {
    const { endpoint, bearerToken } = req.body;

    if (!endpoint || !bearerToken) {
      throw createError('Endpoint and bearer token are required', 400);
    }

    // Validate the bearer token against our database
    const recipient = await recipientService.validateToken(bearerToken);
    
    if (!recipient) {
      throw createError('Invalid or expired token', 401);
    }

    // Generate JWT for the recipient session
    const jwtSecret = getJwtSecretCached();
    const token = jwt.sign(
      {
        serverUrl: endpoint,
        recipientId: recipient.id,
        recipientName: recipient.name,
        role: 'recipient',
      },
      jwtSecret,
      { expiresIn: '24h' }
    );

    // Set HttpOnly cookie for secure token storage
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: '/',
    });

    res.json({
      success: true,
      // Token still returned for backward compatibility with Authorization header
      token,
      user: {
        serverUrl: endpoint,
        recipientId: recipient.id,
        recipientName: recipient.name,
        role: 'recipient',
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/logout', (_req, res) => {
  // Clear the HttpOnly cookie
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  });
  res.json({ success: true });
});

router.get('/validate', async (req, res, next) => {
  try {
    // Try cookie first, then Authorization header for backward compatibility
    const authHeader = req.headers.authorization;
    const token = req.cookies?.token || 
      (authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null);

    if (!token) {
      throw createError('No token provided', 401);
    }

    const jwtSecret = getJwtSecretCached();
    const decoded = jwt.verify(token, jwtSecret) as {
      adminId?: string;
      email?: string;
      role: string;
      recipientId?: string;
      recipientName?: string;
      serverUrl?: string;
    };

    // For admin users, fetch fresh data
    if (decoded.adminId) {
      const admin = await adminService.getAdmin(decoded.adminId);
      if (!admin) {
        throw createError('Admin not found', 401);
      }
      res.json({
        valid: true,
        user: {
          id: admin.id,
          email: admin.email,
          name: admin.name,
          role: admin.role,
          mustChangePassword: admin.mustChangePassword,
        },
      });
    } else {
      // Recipient
      res.json({
        valid: true,
        user: {
          serverUrl: decoded.serverUrl,
          role: decoded.role,
          recipientId: decoded.recipientId,
          recipientName: decoded.recipientName,
        },
      });
    }
  } catch (error) {
    next(error);
  }
});

// Get CSRF token for state-changing requests
// Only available to authenticated users
router.get('/csrf-token', authenticateToken, async (req: AuthenticatedRequest, res, next) => {
  try {
    // Use the auth token from cookie as session identifier
    const sessionId = req.cookies?.token;
    if (!sessionId) {
      throw createError('Session required for CSRF token', 401);
    }

    const csrfToken = await generateCsrfToken(sessionId);
    res.json({ csrfToken });
  } catch (error) {
    next(error);
  }
});

export { router as authRoutes };
