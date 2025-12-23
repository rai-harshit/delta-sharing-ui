/**
 * Storage Configuration and Browser Routes
 * API endpoints for managing cloud storage configurations and browsing
 */

import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { storageConfigService, CreateStorageConfigInput } from '../services/storageConfigService.js';
import { storageBrowserService } from '../services/storageBrowserService.js';
import { authenticateAdmin, AuthenticatedRequest, requirePermission, Permissions } from '../middleware/auth.js';

const router = Router();

// All storage routes require admin authentication
router.use(authenticateAdmin);

// ============================================
// Storage Configuration Routes
// ============================================

// Validation schemas
const createConfigSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['s3', 'azure', 'gcs']),
  isDefault: z.boolean().optional(),
  // S3
  s3Region: z.string().optional(),
  s3AccessKeyId: z.string().optional(),
  s3SecretKey: z.string().optional(),
  s3Endpoint: z.string().optional(),
  // Azure
  azureAccount: z.string().optional(),
  azureAccessKey: z.string().optional(),
  azureConnectionStr: z.string().optional(),
  // GCS
  gcsProjectId: z.string().optional(),
  gcsKeyFile: z.string().optional(),
});

const updateConfigSchema = createConfigSchema.partial().omit({ type: true });

/**
 * GET /api/storage/configs
 * List all storage configurations
 */
router.get('/configs', requirePermission(Permissions.STORAGE_VIEW), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const configs = await storageConfigService.listConfigs();
    res.json({ success: true, data: configs });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/storage/configs
 * Create a new storage configuration
 */
router.post('/configs', requirePermission(Permissions.STORAGE_CREATE), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const data = createConfigSchema.parse(req.body);
    const config = await storageConfigService.createConfig(
      data as CreateStorageConfigInput,
      req.user?.adminId
    );
    res.status(201).json({ success: true, data: config });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    next(error);
  }
});

/**
 * GET /api/storage/configs/:id
 * Get a storage configuration by ID
 */
router.get('/configs/:id', requirePermission(Permissions.STORAGE_VIEW), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const config = await storageConfigService.getConfig(req.params.id);
    if (!config) {
      res.status(404).json({ success: false, error: 'Configuration not found' });
      return;
    }
    res.json({ success: true, data: config });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/storage/configs/:id
 * Update a storage configuration
 */
router.put('/configs/:id', requirePermission(Permissions.STORAGE_EDIT), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const data = updateConfigSchema.parse(req.body);
    const config = await storageConfigService.updateConfig(req.params.id, data);
    res.json({ success: true, data: config });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    if (error instanceof Error && error.message === 'Storage configuration not found') {
      res.status(404).json({ success: false, error: error.message });
      return;
    }
    next(error);
  }
});

/**
 * DELETE /api/storage/configs/:id
 * Delete a storage configuration
 */
router.delete('/configs/:id', requirePermission(Permissions.STORAGE_DELETE), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    await storageConfigService.deleteConfig(req.params.id);
    res.json({ success: true, message: 'Configuration deleted' });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/storage/configs/:id/test
 * Test a storage configuration connection
 */
router.post('/configs/:id/test', requirePermission(Permissions.STORAGE_VIEW), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await storageConfigService.testConnection(req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// ============================================
// Storage Browser Routes
// ============================================

/**
 * GET /api/storage/browse/:configId/buckets
 * List all buckets/containers for a storage configuration
 */
router.get('/browse/:configId/buckets', requirePermission(Permissions.STORAGE_VIEW), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const buckets = await storageBrowserService.listBuckets(req.params.configId);
    res.json({ success: true, data: buckets });
  } catch (error) {
    if (error instanceof Error && error.message === 'Storage configuration not found') {
      res.status(404).json({ success: false, error: error.message });
      return;
    }
    next(error);
  }
});

/**
 * GET /api/storage/browse/:configId/list
 * List files and folders at a given path
 * Query params: bucket (required), path (optional)
 */
router.get('/browse/:configId/list', requirePermission(Permissions.STORAGE_VIEW), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { bucket, path } = req.query;
    
    if (!bucket || typeof bucket !== 'string') {
      res.status(400).json({ success: false, error: 'Bucket name is required' });
      return;
    }

    const items = await storageBrowserService.listPath(
      req.params.configId,
      bucket,
      typeof path === 'string' ? path : ''
    );
    res.json({ success: true, data: items });
  } catch (error) {
    if (error instanceof Error && error.message === 'Storage configuration not found') {
      res.status(404).json({ success: false, error: error.message });
      return;
    }
    next(error);
  }
});

/**
 * GET /api/storage/browse/:configId/detect
 * Detect Delta tables at a given path
 * Query params: bucket (required), path (optional), maxDepth (optional, default 3)
 */
router.get('/browse/:configId/detect', requirePermission(Permissions.STORAGE_VIEW), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { bucket, path, maxDepth } = req.query;
    
    if (!bucket || typeof bucket !== 'string') {
      res.status(400).json({ success: false, error: 'Bucket name is required' });
      return;
    }

    const tables = await storageBrowserService.detectDeltaTables(
      req.params.configId,
      bucket,
      typeof path === 'string' ? path : '',
      maxDepth ? parseInt(maxDepth as string, 10) : 3
    );
    res.json({ success: true, data: tables });
  } catch (error) {
    if (error instanceof Error && error.message === 'Storage configuration not found') {
      res.status(404).json({ success: false, error: error.message });
      return;
    }
    next(error);
  }
});

/**
 * GET /api/storage/browse/:configId/preview
 * Preview Delta table data
 * Query params: location (required), limit (optional, default 10)
 */
router.get('/browse/:configId/preview', requirePermission(Permissions.STORAGE_VIEW), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { location, limit } = req.query;
    
    if (!location || typeof location !== 'string') {
      res.status(400).json({ success: false, error: 'Table location is required' });
      return;
    }

    const preview = await storageBrowserService.previewTable(
      req.params.configId,
      location,
      limit ? parseInt(limit as string, 10) : 10
    );
    res.json({ success: true, data: preview });
  } catch (error) {
    if (error instanceof Error && error.message === 'Storage configuration not found') {
      res.status(404).json({ success: false, error: error.message });
      return;
    }
    next(error);
  }
});

export { router as storageRoutes };

