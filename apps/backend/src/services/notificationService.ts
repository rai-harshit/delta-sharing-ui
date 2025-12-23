import { prisma } from '../db/client.js';

export type NotificationType = 
  | 'token_expiring'
  | 'token_expired'
  | 'access_expiring'
  | 'access_expired'
  | 'failed_access'
  | 'storage_error';

export type NotificationSeverity = 'info' | 'warning' | 'error';

export interface Notification {
  id: string;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  message: string;
  link?: string;
  linkText?: string;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

export const notificationService = {
  /**
   * Get all current notifications based on system state
   */
  async getNotifications(): Promise<{ notifications: Notification[]; unreadCount: number }> {
    const notifications: Notification[] = [];
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // 1. Check for expiring tokens (within 7 days)
    const expiringTokens = await prisma.recipientToken.findMany({
      where: {
        isActive: true,
        expiresAt: {
          gte: now,
          lte: sevenDaysFromNow,
        },
      },
      include: {
        recipient: {
          select: { id: true, name: true },
        },
      },
      orderBy: { expiresAt: 'asc' },
    });

    for (const token of expiringTokens) {
      const daysUntilExpiry = Math.ceil(
        (token.expiresAt!.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
      );
      notifications.push({
        id: `token-expiring-${token.id}`,
        type: 'token_expiring',
        severity: daysUntilExpiry <= 3 ? 'warning' : 'info',
        title: 'Token Expiring Soon',
        message: `Recipient "${token.recipient.name}" token expires in ${daysUntilExpiry} day${daysUntilExpiry > 1 ? 's' : ''}`,
        link: `/recipients/${token.recipient.id}`,
        linkText: 'View Recipient',
        createdAt: now,
        metadata: {
          recipientId: token.recipient.id,
          recipientName: token.recipient.name,
          expiresAt: token.expiresAt,
          daysUntilExpiry,
        },
      });
    }

    // 2. Check for expired tokens (still active but past expiry)
    const expiredTokens = await prisma.recipientToken.findMany({
      where: {
        isActive: true,
        expiresAt: {
          lt: now,
        },
      },
      include: {
        recipient: {
          select: { id: true, name: true },
        },
      },
    });

    for (const token of expiredTokens) {
      notifications.push({
        id: `token-expired-${token.id}`,
        type: 'token_expired',
        severity: 'error',
        title: 'Token Expired',
        message: `Recipient "${token.recipient.name}" token has expired`,
        link: `/recipients/${token.recipient.id}`,
        linkText: 'Rotate Token',
        createdAt: now,
        metadata: {
          recipientId: token.recipient.id,
          recipientName: token.recipient.name,
          expiredAt: token.expiresAt,
        },
      });
    }

    // 3. Check for expiring access grants (within 7 days)
    const expiringGrants = await prisma.accessGrant.findMany({
      where: {
        expiresAt: {
          gte: now,
          lte: sevenDaysFromNow,
        },
      },
      include: {
        recipient: {
          select: { id: true, name: true },
        },
        share: {
          select: { id: true, name: true },
        },
      },
      orderBy: { expiresAt: 'asc' },
    });

    for (const grant of expiringGrants) {
      const daysUntilExpiry = Math.ceil(
        (grant.expiresAt!.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
      );
      notifications.push({
        id: `access-expiring-${grant.id}`,
        type: 'access_expiring',
        severity: daysUntilExpiry <= 3 ? 'warning' : 'info',
        title: 'Access Expiring Soon',
        message: `"${grant.recipient.name}" access to "${grant.share.name}" expires in ${daysUntilExpiry} day${daysUntilExpiry > 1 ? 's' : ''}`,
        link: `/recipients/${grant.recipient.id}`,
        linkText: 'Manage Access',
        createdAt: now,
        metadata: {
          recipientId: grant.recipient.id,
          recipientName: grant.recipient.name,
          shareId: grant.share.id,
          shareName: grant.share.name,
          expiresAt: grant.expiresAt,
          daysUntilExpiry,
        },
      });
    }

    // 4. Check for expired access grants
    const expiredGrants = await prisma.accessGrant.findMany({
      where: {
        expiresAt: {
          lt: now,
        },
      },
      include: {
        recipient: {
          select: { id: true, name: true },
        },
        share: {
          select: { id: true, name: true },
        },
      },
    });

    for (const grant of expiredGrants) {
      notifications.push({
        id: `access-expired-${grant.id}`,
        type: 'access_expired',
        severity: 'warning',
        title: 'Access Expired',
        message: `"${grant.recipient.name}" access to "${grant.share.name}" has expired`,
        link: `/recipients/${grant.recipient.id}`,
        linkText: 'Renew Access',
        createdAt: now,
        metadata: {
          recipientId: grant.recipient.id,
          recipientName: grant.recipient.name,
          shareId: grant.share.id,
          shareName: grant.share.name,
          expiredAt: grant.expiresAt,
        },
      });
    }

    // 5. Check for failed access attempts in last 24 hours
    const failedAttempts = await prisma.auditLog.groupBy({
      by: ['recipientId'],
      where: {
        status: 'error',
        timestamp: {
          gte: twentyFourHoursAgo,
        },
        recipientId: {
          not: null,
        },
      },
      _count: {
        id: true,
      },
    });

    for (const attempt of failedAttempts) {
      if (attempt.recipientId && attempt._count.id >= 3) {
        const recipient = await prisma.recipient.findUnique({
          where: { id: attempt.recipientId },
          select: { id: true, name: true },
        });

        if (recipient) {
          notifications.push({
            id: `failed-access-${recipient.id}`,
            type: 'failed_access',
            severity: attempt._count.id >= 10 ? 'error' : 'warning',
            title: 'Failed Access Attempts',
            message: `${attempt._count.id} failed access attempts from "${recipient.name}" in the last 24 hours`,
            link: `/audit?recipientId=${recipient.id}&status=error`,
            linkText: 'View Audit Logs',
            createdAt: now,
            metadata: {
              recipientId: recipient.id,
              recipientName: recipient.name,
              failedCount: attempt._count.id,
            },
          });
        }
      }
    }

    // Sort by severity (error > warning > info) then by createdAt
    const severityOrder: Record<NotificationSeverity, number> = {
      error: 0,
      warning: 1,
      info: 2,
    };

    notifications.sort((a, b) => {
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    return {
      notifications,
      unreadCount: notifications.filter(n => n.severity === 'error' || n.severity === 'warning').length,
    };
  },

  /**
   * Get notification counts by severity
   */
  async getCounts(): Promise<{ total: number; errors: number; warnings: number; info: number }> {
    const { notifications } = await this.getNotifications();
    
    return {
      total: notifications.length,
      errors: notifications.filter(n => n.severity === 'error').length,
      warnings: notifications.filter(n => n.severity === 'warning').length,
      info: notifications.filter(n => n.severity === 'info').length,
    };
  },
};





