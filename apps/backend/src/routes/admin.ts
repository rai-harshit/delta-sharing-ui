import { Router, Response, NextFunction } from 'express';
import type { Router as RouterType } from 'express';
import { z } from 'zod';
import { 
  requirePermission,
  requireRole,
  Permissions,
  AuthenticatedRequest 
} from '../middleware/auth.js';
import { auditService } from '../services/auditService.js';
import { notificationService } from '../services/notificationService.js';
import { adminService } from '../services/adminService.js';
import { createError } from '../middleware/errorHandler.js';

const router: RouterType = Router();

// ============================================================================
// NOTIFICATIONS
// ============================================================================

/**
 * GET /api/admin/notifications
 * Get all system notifications
 */
router.get('/notifications', requirePermission(Permissions.AUDIT_VIEW), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await notificationService.getNotifications();

    res.json({
      success: true,
      data: {
        notifications: result.notifications.map(n => ({
          ...n,
          createdAt: n.createdAt.toISOString(),
        })),
        unreadCount: result.unreadCount,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/notifications/counts
 * Get notification counts by severity
 */
router.get('/notifications/counts', requirePermission(Permissions.AUDIT_VIEW), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const counts = await notificationService.getCounts();

    res.json({
      success: true,
      data: counts,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// USER MANAGEMENT
// ============================================================================

/**
 * GET /api/admin/users
 * List all admin users
 */
router.get('/users', requirePermission(Permissions.ADMIN_USERS_VIEW), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const users = await adminService.listAdmins();

    res.json({
      success: true,
      data: users.map(u => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        createdAt: u.createdAt.toISOString(),
        lastLoginAt: u.lastLoginAt?.toISOString() || null,
      })),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/users
 * Create a new admin user
 */
const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().optional(),
  role: z.enum(['admin', 'editor', 'viewer']).optional().default('viewer'),
});

router.post('/users', requireRole('admin'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const data = createUserSchema.parse(req.body);

    // Check if user already exists
    const existing = await adminService.getAdminByEmail(data.email);
    if (existing) {
      throw createError('User with this email already exists', 409);
    }

    const user = await adminService.createAdmin({
      email: data.email,
      password: data.password,
      name: data.name,
      role: data.role,
    });

    res.status(201).json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, error.errors));
    }
    next(error);
  }
});

/**
 * DELETE /api/admin/users/:userId
 * Delete an admin user
 */
router.delete('/users/:userId', requireRole('admin'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;

    // Prevent self-deletion
    if (req.user?.adminId === userId) {
      throw createError('You cannot delete your own account', 400);
    }

    const user = await adminService.getAdmin(userId);
    if (!user) {
      throw createError('User not found', 404);
    }

    // Use prisma directly to delete
    const { prisma } = await import('../db/client.js');
    await prisma.adminUser.delete({
      where: { id: userId },
    });

    res.json({
      success: true,
      message: `User ${user.email} deleted successfully`,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/audit-logs
 * Query audit logs with optional filters
 */
router.get('/audit-logs', requirePermission(Permissions.AUDIT_VIEW), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const {
      startDate,
      endDate,
      recipientId,
      shareName,
      action,
      status,
      limit = '100',
      offset = '0',
    } = req.query;

    const filters = {
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      recipientId: recipientId as string | undefined,
      shareName: shareName as string | undefined,
      action: action as string | undefined,
      status: status as 'success' | 'error' | undefined,
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
    };

    const result = await auditService.query(filters);

    res.json({
      success: true,
      data: {
        logs: result.logs.map(log => ({
          id: log.id,
          timestamp: log.timestamp.toISOString(),
          action: log.action,
          recipient: log.recipient ? {
            id: log.recipient.id,
            name: log.recipient.name,
          } : null,
          shareName: log.shareName,
          schemaName: log.schemaName,
          tableName: log.tableName,
          status: log.status,
          errorMessage: log.errorMessage,
          rowsAccessed: log.rowsAccessed,
          bytesRead: log.bytesRead,
          durationMs: log.durationMs,
          ipAddress: log.ipAddress,
        })),
        total: result.total,
        hasMore: result.hasMore,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/audit-logs/summary
 * Get summary statistics for audit logs
 */
router.get('/audit-logs/summary', requirePermission(Permissions.AUDIT_VIEW), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const days = parseInt(req.query.days as string, 10) || 30;
    const summary = await auditService.getSummary(days);

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/audit-logs/activity
 * Get daily activity counts
 */
router.get('/audit-logs/activity', requirePermission(Permissions.AUDIT_VIEW), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const days = parseInt(req.query.days as string, 10) || 30;
    const activity = await auditService.getDailyActivity(days);

    res.json({
      success: true,
      data: activity,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/audit-logs/top-tables
 * Get most accessed tables
 */
router.get('/audit-logs/top-tables', requirePermission(Permissions.AUDIT_VIEW), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const days = parseInt(req.query.days as string, 10) || 30;
    const limit = parseInt(req.query.limit as string, 10) || 10;
    const topTables = await auditService.getTopTables(days, limit);

    res.json({
      success: true,
      data: topTables,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/audit-logs/top-recipients
 * Get top recipients by access count
 */
router.get('/audit-logs/top-recipients', requirePermission(Permissions.AUDIT_VIEW), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const days = parseInt(req.query.days as string, 10) || 30;
    const limit = parseInt(req.query.limit as string, 10) || 10;
    const topRecipients = await auditService.getTopRecipients(days, limit);

    res.json({
      success: true,
      data: topRecipients,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/audit-logs/export
 * Export audit logs as CSV
 */
router.get('/audit-logs/export', requirePermission(Permissions.AUDIT_EXPORT), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const {
      startDate,
      endDate,
      recipientId,
      shareName,
      action,
      status,
    } = req.query;

    const filters = {
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      recipientId: recipientId as string | undefined,
      shareName: shareName as string | undefined,
      action: action as string | undefined,
      status: status as 'success' | 'error' | undefined,
    };

    const csv = await auditService.exportCsv(filters);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/audit-logs/cleanup
 * Clean up old audit logs (admin only)
 */
router.post('/audit-logs/cleanup', requirePermission(Permissions.AUDIT_CLEANUP), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const retentionDays = parseInt(req.body.retentionDays as string, 10) || 90;
    const deletedCount = await auditService.cleanup(retentionDays);

    res.json({
      success: true,
      data: {
        deletedCount,
        message: `Deleted ${deletedCount} audit log entries older than ${retentionDays} days`,
      },
    });
  } catch (error) {
    next(error);
  }
});

export { router as adminRoutes };






