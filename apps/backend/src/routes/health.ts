import { Router } from 'express';
import { checkDatabaseHealth } from '../db/client.js';
import { configSyncService } from '../services/configSyncService.js';

const router = Router();

// Version info (would be injected at build time in production)
const VERSION = process.env.SERVICE_VERSION || '0.1.0';
const BUILD_TIME = process.env.BUILD_TIME || new Date().toISOString();
const START_TIME = new Date();

interface DependencyCheck {
  status: 'up' | 'down' | 'degraded';
  latencyMs?: number;
  message?: string;
  lastChecked: string;
}

interface HealthResponse {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  service: string;
  version: string;
  uptime: number;
  mode: 'hybrid' | 'standalone';
  dependencies: {
    database: DependencyCheck;
    ossServer?: DependencyCheck;
    redis?: DependencyCheck;
  };
}

/**
 * GET /health
 * Basic health check - always returns 200 if the service is running
 * Used for basic liveness probes
 */
router.get('/', async (_req, res) => {
  const uptime = Math.floor((Date.now() - START_TIME.getTime()) / 1000);
  
  let syncStatus = null;
  if (configSyncService.isHybridMode()) {
    try {
      syncStatus = await configSyncService.getStatus();
    } catch (error) {
      syncStatus = { error: 'Failed to get sync status' };
    }
  }

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'delta-sharing-ui-backend',
    version: VERSION,
    buildTime: BUILD_TIME,
    uptime: `${uptime}s`,
    mode: configSyncService.isHybridMode() ? 'hybrid' : 'standalone',
    sync: syncStatus,
  });
});

/**
 * GET /health/live
 * Kubernetes liveness probe
 * Returns 200 if the application is running (not deadlocked)
 * Returns 503 if the application should be restarted
 */
router.get('/live', async (_req, res) => {
  // Simple liveness check - if we can respond, we're alive
  // Add more sophisticated deadlock detection here if needed
  
  const memoryUsage = process.memoryUsage();
  const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);
  
  // If using more than 90% of heap, report as unhealthy
  const heapPercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
  const isHealthy = heapPercent < 90;

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'alive' : 'unhealthy',
    timestamp: new Date().toISOString(),
    memory: {
      heapUsed: `${heapUsedMB}MB`,
      heapTotal: `${heapTotalMB}MB`,
      heapPercent: `${heapPercent.toFixed(1)}%`,
    },
  });
});

/**
 * GET /health/ready
 * Kubernetes readiness probe
 * Returns 200 if the application can handle requests
 * Returns 503 if the application should not receive traffic
 */
router.get('/ready', async (_req, res) => {
  const checks: HealthResponse['dependencies'] = {
    database: await checkDatabase(),
  };

  // Check OSS server in hybrid mode
  if (configSyncService.isHybridMode()) {
    checks.ossServer = await checkOssServer();
  }

  // Determine overall status
  const allUp = Object.values(checks).every(c => c.status === 'up');
  const anyDown = Object.values(checks).some(c => c.status === 'down');
  
  const overallStatus = allUp ? 'healthy' : anyDown ? 'unhealthy' : 'degraded';
  const isReady = overallStatus !== 'unhealthy';

  const response: HealthResponse = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    service: 'delta-sharing-ui-backend',
    version: VERSION,
    uptime: Math.floor((Date.now() - START_TIME.getTime()) / 1000),
    mode: configSyncService.isHybridMode() ? 'hybrid' : 'standalone',
    dependencies: checks,
  };

  res.status(isReady ? 200 : 503).json(response);
});

/**
 * GET /health/detailed
 * Detailed health check with all dependency statuses
 * Useful for dashboards and monitoring
 */
router.get('/detailed', async (_req, res) => {
  const [dbHealth, ossHealth] = await Promise.all([
    checkDatabase(),
    configSyncService.isHybridMode() ? checkOssServer() : Promise.resolve(null),
  ]);

  const memoryUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();

  res.json({
    status: 'detailed',
    timestamp: new Date().toISOString(),
    service: {
      name: 'delta-sharing-ui-backend',
      version: VERSION,
      buildTime: BUILD_TIME,
      nodeVersion: process.version,
      platform: process.platform,
      uptime: Math.floor((Date.now() - START_TIME.getTime()) / 1000),
      mode: configSyncService.isHybridMode() ? 'hybrid' : 'standalone',
    },
    memory: {
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      external: Math.round(memoryUsage.external / 1024 / 1024),
      rss: Math.round(memoryUsage.rss / 1024 / 1024),
      unit: 'MB',
    },
    cpu: {
      user: Math.round(cpuUsage.user / 1000),
      system: Math.round(cpuUsage.system / 1000),
      unit: 'ms',
    },
    dependencies: {
      database: dbHealth,
      ...(ossHealth && { ossServer: ossHealth }),
    },
  });
});

/**
 * Check database health
 */
async function checkDatabase(): Promise<DependencyCheck> {
  const health = await checkDatabaseHealth();
  
  return {
    status: health.status === 'up' ? 'up' : 'down',
    latencyMs: health.latencyMs,
    message: health.error,
    lastChecked: new Date().toISOString(),
  };
}

/**
 * Check OSS Delta Sharing server health
 */
async function checkOssServer(): Promise<DependencyCheck> {
  const ossServerUrl = process.env.OSS_DELTA_SERVER_URL;
  
  if (!ossServerUrl) {
    return {
      status: 'down',
      message: 'OSS server URL not configured',
      lastChecked: new Date().toISOString(),
    };
  }

  const start = Date.now();
  try {
    const response = await fetch(`${ossServerUrl}/shares`, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000),
    });
    
    return {
      status: response.ok ? 'up' : 'degraded',
      latencyMs: Date.now() - start,
      message: response.ok ? undefined : `HTTP ${response.status}`,
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: 'down',
      latencyMs: Date.now() - start,
      message: error instanceof Error ? error.message : 'Connection failed',
      lastChecked: new Date().toISOString(),
    };
  }
}

// Force sync endpoint (for debugging)
router.post('/sync', async (_req, res) => {
  if (!configSyncService.isHybridMode()) {
    return res.status(400).json({
      error: 'Not in hybrid mode',
    });
  }

  try {
    await configSyncService.forceSync();
    const status = await configSyncService.getStatus();
    res.json({
      success: true,
      message: 'Config synced successfully',
      status,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export { router as healthRoutes };
