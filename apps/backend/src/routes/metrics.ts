/**
 * Prometheus Metrics Endpoint
 * 
 * Exposes application metrics for Prometheus scraping.
 * 
 * Endpoint: GET /metrics
 */

import { Router, Request, Response } from 'express';
import { metricsStore } from '../middleware/metrics.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * GET /metrics
 * 
 * Returns all collected metrics in Prometheus format.
 * This endpoint should be protected in production or only exposed internally.
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const metrics = await metricsStore.getMetrics();
    
    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(metrics);
  } catch (error) {
    logger.error('Error generating metrics', error as Error);
    res.status(500).send('Error generating metrics');
  }
});

export { router as metricsRoutes };

