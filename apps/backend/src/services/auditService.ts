/**
 * Audit Service
 * Handles logging and querying of audit events
 */

import { prisma } from '../db/client.js';
import { Prisma } from '@prisma/client';

export interface AuditLogEntry {
  action: string;
  recipientId?: string;
  shareName?: string;
  schemaName?: string;
  tableName?: string;
  ipAddress?: string;
  userAgent?: string;
  status: 'success' | 'error';
  errorMessage?: string;
  rowsAccessed?: number;
  bytesRead?: number;
  durationMs?: number;
}

export interface AuditLogFilters {
  startDate?: Date;
  endDate?: Date;
  recipientId?: string;
  shareName?: string;
  action?: string;
  status?: 'success' | 'error';
  limit?: number;
  offset?: number;
}

export interface AuditSummary {
  totalQueries: number;
  totalRowsAccessed: number;
  totalBytesRead: number;
  uniqueRecipients: number;
  uniqueShares: number;
  successRate: number;
  recentActivity: {
    date: string;
    count: number;
  }[];
  topTables: {
    shareName: string;
    schemaName: string;
    tableName: string;
    accessCount: number;
  }[];
  topRecipients: {
    recipientId: string;
    recipientName: string;
    accessCount: number;
  }[];
}

export const auditService = {
  /**
   * Log an audit event
   */
  async log(entry: AuditLogEntry) {
    return prisma.auditLog.create({
      data: {
        action: entry.action,
        recipientId: entry.recipientId,
        shareName: entry.shareName,
        schemaName: entry.schemaName,
        tableName: entry.tableName,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
        status: entry.status,
        errorMessage: entry.errorMessage,
        rowsAccessed: entry.rowsAccessed,
        bytesRead: entry.bytesRead,
        durationMs: entry.durationMs,
      },
    });
  },

  /**
   * Query audit logs with filters
   */
  async query(filters: AuditLogFilters = {}) {
    const {
      startDate,
      endDate,
      recipientId,
      shareName,
      action,
      status,
      limit = 100,
      offset = 0,
    } = filters;

    const where: Prisma.AuditLogWhereInput = {};

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = startDate;
      if (endDate) where.timestamp.lte = endDate;
    }

    if (recipientId) where.recipientId = recipientId;
    if (shareName) where.shareName = shareName;
    if (action) where.action = action;
    if (status) where.status = status;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          recipient: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { timestamp: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      logs,
      total,
      hasMore: offset + limit < total,
    };
  },

  /**
   * Get audit log summary statistics
   */
  async getSummary(days: number = 30): Promise<AuditSummary> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const where: Prisma.AuditLogWhereInput = {
      timestamp: { gte: startDate },
    };

    // Get basic counts
    const [
      totalQueries,
      successCount,
      aggregates,
      uniqueRecipients,
      uniqueShares,
    ] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.count({ where: { ...where, status: 'success' } }),
      prisma.auditLog.aggregate({
        where,
        _sum: {
          rowsAccessed: true,
          bytesRead: true,
        },
      }),
      prisma.auditLog.groupBy({
        by: ['recipientId'],
        where: { ...where, recipientId: { not: null } },
      }),
      prisma.auditLog.groupBy({
        by: ['shareName'],
        where: { ...where, shareName: { not: null } },
      }),
    ]);

    // Get daily activity for the past `days`
    const recentActivity = await this.getDailyActivity(days);

    // Get top tables
    const topTables = await this.getTopTables(days, 10);

    // Get top recipients
    const topRecipients = await this.getTopRecipients(days, 10);

    return {
      totalQueries,
      totalRowsAccessed: aggregates._sum.rowsAccessed || 0,
      totalBytesRead: aggregates._sum.bytesRead || 0,
      uniqueRecipients: uniqueRecipients.length,
      uniqueShares: uniqueShares.length,
      successRate: totalQueries > 0 ? (successCount / totalQueries) * 100 : 100,
      recentActivity,
      topTables,
      topRecipients,
    };
  },

  /**
   * Get daily activity counts
   */
  async getDailyActivity(days: number = 30) {
    // Use UTC dates consistently to avoid timezone issues
    const now = new Date();
    const startDate = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - days + 1
    ));

    // Get all logs in the date range
    const logs = await prisma.auditLog.findMany({
      where: {
        timestamp: { gte: startDate },
      },
      select: {
        timestamp: true,
      },
    });

    // Group by UTC date
    const dailyCounts: Record<string, number> = {};
    for (const log of logs) {
      const dateStr = log.timestamp.toISOString().split('T')[0];
      dailyCounts[dateStr] = (dailyCounts[dateStr] || 0) + 1;
    }

    // Fill in missing dates (including today) using UTC
    const result: { date: string; count: number }[] = [];
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setUTCDate(date.getUTCDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      result.push({
        date: dateStr,
        count: dailyCounts[dateStr] || 0,
      });
    }

    return result;
  },

  /**
   * Get most accessed tables
   */
  async getTopTables(days: number = 30, limit: number = 10) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const tableCounts = await prisma.auditLog.groupBy({
      by: ['shareName', 'schemaName', 'tableName'],
      where: {
        timestamp: { gte: startDate },
        tableName: { not: null },
        action: { in: ['table_query', 'table_metadata', 'table_preview'] },
      },
      _count: true,
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
      take: limit,
    });

    return tableCounts.map(t => ({
      shareName: t.shareName || 'unknown',
      schemaName: t.schemaName || 'unknown',
      tableName: t.tableName || 'unknown',
      accessCount: t._count,
    }));
  },

  /**
   * Get top recipients by access count
   */
  async getTopRecipients(days: number = 30, limit: number = 10) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const recipientCounts = await prisma.auditLog.groupBy({
      by: ['recipientId'],
      where: {
        timestamp: { gte: startDate },
        recipientId: { not: null },
      },
      _count: true,
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
      take: limit,
    });

    // Get recipient names
    const recipientIds = recipientCounts
      .map(r => r.recipientId)
      .filter((id): id is string => id !== null);

    const recipients = await prisma.recipient.findMany({
      where: { id: { in: recipientIds } },
      select: { id: true, name: true },
    });

    const recipientMap = new Map(recipients.map(r => [r.id, r.name]));

    return recipientCounts.map(r => ({
      recipientId: r.recipientId || 'unknown',
      recipientName: recipientMap.get(r.recipientId || '') || 'Unknown',
      accessCount: r._count,
    }));
  },

  /**
   * Export audit logs as CSV
   */
  async exportCsv(filters: AuditLogFilters = {}): Promise<string> {
    const { logs } = await this.query({ ...filters, limit: 10000 });

    const headers = [
      'timestamp',
      'action',
      'recipient',
      'share',
      'schema',
      'table',
      'status',
      'rows_accessed',
      'bytes_read',
      'duration_ms',
      'ip_address',
      'error_message',
    ];

    const rows = logs.map(log => [
      log.timestamp.toISOString(),
      log.action,
      log.recipient?.name || log.recipientId || '',
      log.shareName || '',
      log.schemaName || '',
      log.tableName || '',
      log.status,
      log.rowsAccessed?.toString() || '',
      log.bytesRead?.toString() || '',
      log.durationMs?.toString() || '',
      log.ipAddress || '',
      log.errorMessage || '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    return csvContent;
  },

  /**
   * Delete old audit logs (for cleanup)
   */
  async cleanup(retentionDays: number = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await prisma.auditLog.deleteMany({
      where: {
        timestamp: { lt: cutoffDate },
      },
    });

    return result.count;
  },
};

