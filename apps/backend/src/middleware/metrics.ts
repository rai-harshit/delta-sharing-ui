/**
 * Prometheus Metrics Middleware
 * 
 * Provides application metrics for monitoring:
 * - HTTP request duration
 * - Request counts by status
 * - Active connections
 * - Business metrics (shares, recipients, etc.)
 */

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/client.js';
import { logger } from '../utils/logger.js';

// ============================================
// Metrics Registry
// ============================================

interface Gauge {
  set: (value: number) => void;
  inc: () => void;
  dec: () => void;
}

// Simple in-memory metrics store (production would use prom-client)
class MetricsStore {
  private histograms: Map<string, { buckets: number[]; values: { labels: Record<string, string>; value: number }[] }> = new Map();
  private counters: Map<string, { labels: Record<string, string>; value: number }[]> = new Map();
  private gauges: Map<string, number> = new Map();

  histogram(name: string, help: string, options: { labelNames: string[]; buckets: number[] }) {
    if (!this.histograms.has(name)) {
      this.histograms.set(name, { buckets: options.buckets, values: [] });
    }
    return {
      labels: (labels: Record<string, string>) => ({
        observe: (value: number) => {
          this.histograms.get(name)!.values.push({ labels, value });
        },
      }),
    };
  }

  counter(name: string, help: string, options: { labelNames: string[] }) {
    if (!this.counters.has(name)) {
      this.counters.set(name, []);
    }
    return {
      labels: (labels: Record<string, string>) => ({
        inc: () => {
          const counters = this.counters.get(name)!;
          const existing = counters.find(c => 
            Object.keys(labels).every(k => c.labels[k] === labels[k])
          );
          if (existing) {
            existing.value++;
          } else {
            counters.push({ labels, value: 1 });
          }
        },
      }),
    };
  }

  gauge(name: string, help: string) {
    if (!this.gauges.has(name)) {
      this.gauges.set(name, 0);
    }
    return {
      set: (value: number) => this.gauges.set(name, value),
      inc: () => this.gauges.set(name, (this.gauges.get(name) || 0) + 1),
      dec: () => this.gauges.set(name, (this.gauges.get(name) || 0) - 1),
    };
  }

  // Export metrics in Prometheus format
  async getMetrics(): Promise<string> {
    const lines: string[] = [];

    // Export histograms
    for (const [name, data] of this.histograms) {
      lines.push(`# HELP ${name} Request duration histogram`);
      lines.push(`# TYPE ${name} histogram`);
      
      const bucketCounts = new Map<string, Map<number, number>>();
      const sums = new Map<string, number>();
      const counts = new Map<string, number>();

      for (const { labels, value } of data.values) {
        const labelStr = Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(',');
        
        if (!bucketCounts.has(labelStr)) {
          bucketCounts.set(labelStr, new Map());
          sums.set(labelStr, 0);
          counts.set(labelStr, 0);
        }

        for (const bucket of data.buckets) {
          const bc = bucketCounts.get(labelStr)!;
          if (value <= bucket) {
            bc.set(bucket, (bc.get(bucket) || 0) + 1);
          }
        }
        sums.set(labelStr, (sums.get(labelStr) || 0) + value);
        counts.set(labelStr, (counts.get(labelStr) || 0) + 1);
      }

      for (const [labelStr, bc] of bucketCounts) {
        for (const bucket of data.buckets) {
          lines.push(`${name}_bucket{${labelStr},le="${bucket}"} ${bc.get(bucket) || 0}`);
        }
        lines.push(`${name}_bucket{${labelStr},le="+Inf"} ${counts.get(labelStr) || 0}`);
        lines.push(`${name}_sum{${labelStr}} ${sums.get(labelStr) || 0}`);
        lines.push(`${name}_count{${labelStr}} ${counts.get(labelStr) || 0}`);
      }
    }

    // Export counters
    for (const [name, counters] of this.counters) {
      lines.push(`# HELP ${name} Counter metric`);
      lines.push(`# TYPE ${name} counter`);
      for (const { labels, value } of counters) {
        const labelStr = Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(',');
        lines.push(`${name}{${labelStr}} ${value}`);
      }
    }

    // Export gauges
    for (const [name, value] of this.gauges) {
      lines.push(`# HELP ${name} Gauge metric`);
      lines.push(`# TYPE ${name} gauge`);
      lines.push(`${name} ${value}`);
    }

    // Add business metrics
    const businessMetrics = await getBusinessMetrics();
    lines.push(...businessMetrics);

    return lines.join('\n');
  }
}

export const metricsStore = new MetricsStore();

// ============================================
// Metric Definitions
// ============================================

// HTTP request duration histogram
const httpRequestDuration = metricsStore.histogram(
  'http_request_duration_seconds',
  'Duration of HTTP requests in seconds',
  {
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  }
);

// HTTP request counter
const httpRequestTotal = metricsStore.counter(
  'http_requests_total',
  'Total number of HTTP requests',
  {
    labelNames: ['method', 'route', 'status_code'],
  }
);

// Active connections gauge
const activeConnections = metricsStore.gauge(
  'active_connections',
  'Number of active connections'
);

// ============================================
// Middleware
// ============================================

/**
 * Metrics collection middleware
 * Records request duration and counts
 */
export function metricsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const start = process.hrtime.bigint();
  
  activeConnections.inc();

  res.on('finish', () => {
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1e9; // Convert to seconds
    
    // Normalize route path (remove IDs for grouping)
    const route = normalizeRoute(req.route?.path || req.path);
    
    const labels = {
      method: req.method,
      route,
      status_code: res.statusCode.toString(),
    };

    httpRequestDuration.labels(labels).observe(durationMs);
    httpRequestTotal.labels(labels).inc();
    
    activeConnections.dec();
  });

  next();
}

/**
 * Normalize route path by replacing UUIDs and IDs with placeholders
 */
function normalizeRoute(path: string): string {
  return path
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
    .replace(/\/[a-z0-9]{25,}/gi, '/:id') // cuid
    .replace(/\/\d+/g, '/:id');
}

// ============================================
// Business Metrics
// ============================================

/**
 * Get current business metrics from database
 */
async function getBusinessMetrics(): Promise<string[]> {
  const lines: string[] = [];

  try {
    // Count shares
    const sharesCount = await prisma.share.count();
    lines.push('# HELP delta_shares_total Total number of shares');
    lines.push('# TYPE delta_shares_total gauge');
    lines.push(`delta_shares_total ${sharesCount}`);

    // Count recipients
    const recipientsCount = await prisma.recipient.count();
    lines.push('# HELP delta_recipients_total Total number of recipients');
    lines.push('# TYPE delta_recipients_total gauge');
    lines.push(`delta_recipients_total ${recipientsCount}`);

    // Count active access grants
    const grantsCount = await prisma.accessGrant.count();
    lines.push('# HELP delta_access_grants_total Total number of access grants');
    lines.push('# TYPE delta_access_grants_total gauge');
    lines.push(`delta_access_grants_total ${grantsCount}`);

    // Count tables
    const tablesCount = await prisma.table.count();
    lines.push('# HELP delta_tables_total Total number of shared tables');
    lines.push('# TYPE delta_tables_total gauge');
    lines.push(`delta_tables_total ${tablesCount}`);

    // Count admin users by role
    const adminUsers = await prisma.adminUser.groupBy({
      by: ['role'],
      _count: true,
    });
    lines.push('# HELP delta_admin_users_total Total number of admin users by role');
    lines.push('# TYPE delta_admin_users_total gauge');
    for (const { role, _count } of adminUsers) {
      lines.push(`delta_admin_users_total{role="${role}"} ${_count}`);
    }

    // Audit log stats (last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const auditStats = await prisma.auditLog.groupBy({
      by: ['action', 'status'],
      where: { timestamp: { gte: oneHourAgo } },
      _count: true,
    });
    lines.push('# HELP delta_audit_logs_hourly Audit log entries in the last hour');
    lines.push('# TYPE delta_audit_logs_hourly gauge');
    for (const { action, status, _count } of auditStats) {
      lines.push(`delta_audit_logs_hourly{action="${action}",status="${status}"} ${_count}`);
    }
  } catch (error) {
    // Log error but don't fail metrics endpoint
    logger.error('Error collecting business metrics', error as Error);
  }

  return lines;
}

