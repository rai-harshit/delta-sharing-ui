import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';

import { prisma } from './db/client.js';
import { errorHandler } from './middleware/errorHandler.js';
import { auditLogger } from './middleware/auditLogger.js';
import { enhancedSecurityHeaders, csrfProtection } from './middleware/security.js';
import { 
  apiRateLimit, 
  authRateLimit, 
  deltaProtocolRateLimit, 
  adminRateLimit 
} from './middleware/rateLimit.js';
import { authRoutes } from './routes/auth.js';
import { sharesRoutes } from './routes/shares.js';
import { recipientsRoutes } from './routes/recipients.js';
import { recipientSharesRoutes } from './routes/recipient-shares.js';
import { deltaProtocolRoutes } from './routes/delta-protocol.js';
import { adminRoutes } from './routes/admin.js';
import { healthRoutes } from './routes/health.js';
import { docsRoutes } from './routes/docs.js';
import { storageRoutes } from './routes/storage.js';
import { ssoRoutes } from './routes/sso.js';
import { webhookRoutes } from './routes/webhooks.js';
import { configSyncService } from './services/configSyncService.js';
import { ossProxyService } from './services/ossProxyService.js';
import { metricsMiddleware } from './middleware/metrics.js';
import { metricsRoutes } from './routes/metrics.js';
import { requestLogger, logger, logStartup, logShutdown } from './utils/logger.js';
import { cache } from './cache/redis.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(enhancedSecurityHeaders);

// CORS configuration - supports multiple origins for cross-origin Recipient Portal
const corsOrigins = process.env.CORS_ORIGIN?.split(',').map(o => o.trim()) || ['http://localhost:3000'];
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    // Check if origin is in the allowed list, or if '*' is allowed
    if (corsOrigins.includes('*') || corsOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
  exposedHeaders: ['Delta-Table-Version'], // Expose Delta protocol headers
}));
app.use(cookieParser());
app.use(express.json());
app.use(requestLogger);

// Metrics collection middleware
app.use(metricsMiddleware);

// Audit logging middleware (logs API access)
app.use(auditLogger);

// Routes with rate limiting
app.use('/metrics', metricsRoutes);  // Prometheus metrics endpoint
app.use('/api/health', healthRoutes);  // No rate limit for health checks
app.use('/api/auth', authRateLimit, authRoutes);  // Stricter limit for auth
app.use('/api/auth/sso', authRateLimit, ssoRoutes);  // SSO authentication
// Apply CSRF protection to cookie-authenticated admin routes (skips Bearer token auth)
app.use('/api/shares', apiRateLimit, csrfProtection, sharesRoutes);
app.use('/api/recipients', apiRateLimit, csrfProtection, recipientsRoutes);
app.use('/api/recipient/shares', apiRateLimit, recipientSharesRoutes);
app.use('/api/delta', deltaProtocolRateLimit, deltaProtocolRoutes); // Higher limit for Delta protocol
app.use('/api/admin', adminRateLimit, csrfProtection, adminRoutes);  // Admin operations
app.use('/api/storage', apiRateLimit, csrfProtection, storageRoutes);
app.use('/api/webhooks', adminRateLimit, csrfProtection, webhookRoutes);  // Webhook management
app.use('/api/docs', docsRoutes);  // No rate limit for docs

// Error handling
app.use(errorHandler);

// Initialize database connection and start server
async function main() {
  try {
    // Initialize cache (Redis if available, in-memory fallback)
    await cache.initialize();
    logger.info('Cache initialized', { 
      redis: cache.isRedisConnected() ? 'connected' : 'not available (using in-memory)'
    });

    // Test database connection
    await prisma.$connect();
    logger.info('Database connected', { database: 'PostgreSQL' });

    // Start config sync service if in hybrid mode
    if (configSyncService.isHybridMode()) {
      logger.info('Hybrid mode enabled - starting config sync service');
      configSyncService.startPeriodicSync(60000); // Sync every 60 seconds
    } else {
      logger.info('Standalone mode - using built-in Delta protocol handlers');
    }

    // Initialize OSS proxy service (creates system token if in hybrid mode)
    await ossProxyService.initialize();
    
    app.listen(PORT, () => {
      logStartup(Number(PORT), {
        mode: configSyncService.isHybridMode() ? 'hybrid' : 'standalone',
        docsUrl: `http://localhost:${PORT}/api/docs/ui`,
        deltaProtocol: configSyncService.isHybridMode() 
          ? 'Handled by OSS Server' 
          : `http://localhost:${PORT}/api/delta`,
      });
    });
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

// Graceful shutdown
async function shutdown(signal: string) {
  logShutdown(signal);
  await cache.disconnect();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

main();

export default app;
