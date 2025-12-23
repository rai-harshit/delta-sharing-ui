import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { 
  authenticateToken, 
  requirePermission,
  Permissions,
  AuthenticatedRequest 
} from '../middleware/auth.js';
import { createError } from '../middleware/errorHandler.js';
import { shareService } from '../services/shareService.js';
import { validateDeltaTable } from '../delta/reader.js';
import { configSyncService } from '../services/configSyncService.js';
import { ossProxyService } from '../services/ossProxyService.js';
import { webhookService } from '../services/webhookService.js';
import { logger } from '../utils/logger.js';

const router = Router();

// List all shares (requires view permission)
router.get('/', requirePermission(Permissions.SHARES_VIEW), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const shares = await shareService.listShares();
    
    // Transform to API format
    const data = shares.map(share => ({
      id: share.id,
      name: share.name,
      comment: share.comment,
      createdAt: share.createdAt.toISOString(),
      createdBy: share.createdBy,
      schemaCount: share.schemas.length,
      tableCount: share.schemas.reduce((sum, s) => sum + s.tables.length, 0),
      recipientCount: share._count.accessGrants,
    }));

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
});

// Get all shared assets (tables and schemas across all shares)
router.get('/assets/all', requirePermission(Permissions.SHARES_VIEW), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const assets = await shareService.getAllAssets();

    res.json({
      success: true,
      data: assets,
    });
  } catch (error) {
    next(error);
  }
});

// Get share details
router.get('/:shareId', requirePermission(Permissions.SHARES_VIEW), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { shareId } = req.params;
    const share = await shareService.getShare(shareId);

    if (!share) {
      throw createError('Share not found', 404);
    }

    res.json({
      success: true,
      data: {
        id: share.id,
        name: share.name,
        comment: share.comment,
        createdAt: share.createdAt.toISOString(),
        createdBy: share.createdBy,
        schemas: share.schemas.map(s => ({
          id: s.id,
          name: s.name,
          tableCount: s.tables.length,
        })),
        recipients: share.accessGrants.map(g => ({
          id: g.recipient.id,
          name: g.recipient.name,
          grantedAt: g.grantedAt.toISOString(),
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get schemas for a share
router.get('/:shareId/schemas', requirePermission(Permissions.SHARES_VIEW), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { shareId } = req.params;
    const schemas = await shareService.listSchemas(shareId);

    res.json({
      success: true,
      data: schemas.map(s => ({
        name: s.name,
        share: shareId,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// Get tables for a schema
router.get('/:shareId/schemas/:schemaName/tables', requirePermission(Permissions.SHARES_VIEW), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { shareId, schemaName } = req.params;
    const tables = await shareService.listTables(shareId, schemaName);

    res.json({
      success: true,
      data: tables.map(t => ({
        name: t.name,
        alias: t.alias,
        displayName: t.alias || t.name, // What recipients will see
        schema: schemaName,
        share: shareId,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// Get all tables for a share
router.get('/:shareId/all-tables', requirePermission(Permissions.SHARES_VIEW), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { shareId } = req.params;
    const tables = await shareService.listAllTables(shareId);

    res.json({
      success: true,
      data: tables,
    });
  } catch (error) {
    next(error);
  }
});

// Get table metadata (reads from actual Delta table)
router.get('/:shareId/schemas/:schemaName/tables/:tableName/metadata', requirePermission(Permissions.SHARES_VIEW), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { shareId, schemaName, tableName } = req.params;
    const share = await shareService.getShare(shareId);
    if (!share) {
      throw createError('Share not found', 404);
    }

    const table = await shareService.getTable(shareId, schemaName, tableName);
    if (!table) {
      throw createError('Table not found', 404);
    }

    try {
      // Use OSS proxy service (routes to OSS server in hybrid mode, custom reader in standalone)
      const metadata = await ossProxyService.getTableMetadata(
        share.name,
        schemaName,
        table.alias || table.name,
        table.location
      );
      const stats = await ossProxyService.getTableStats(
        share.name,
        schemaName,
        table.alias || table.name,
        table.location
      );

      res.json({
        success: true,
        data: {
          format: { provider: 'delta' },
          schema: metadata.columns,
          schemaString: JSON.stringify({
            type: 'struct',
            fields: metadata.columns.map(col => ({
              name: col.name,
              type: col.type,
              nullable: col.nullable,
              metadata: {},
            })),
          }),
          partitionColumns: [],
          numFiles: stats.numFiles,
          numRecords: stats.numRecords,
          size: stats.totalSize,
          version: metadata.version,
          location: table.location,
          name: metadata.name,
        },
      });
    } catch (deltaError) {
      // If Delta table reading fails, return basic info
      logger.error('Failed to read Delta table', deltaError as Error);
      res.json({
        success: true,
        data: {
          format: { provider: 'delta' },
          schema: [],
          partitionColumns: [],
          numFiles: 0,
          numRecords: 0,
          size: 0,
          version: 0,
          location: table.location,
          error: 'Could not read Delta table metadata',
        },
      });
    }
  } catch (error) {
    next(error);
  }
});

// Get table schema (columns and types)
router.get('/:shareId/schemas/:schemaName/tables/:tableName/schema', requirePermission(Permissions.SHARES_VIEW), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { shareId, schemaName, tableName } = req.params;
    const share = await shareService.getShare(shareId);
    if (!share) {
      throw createError('Share not found', 404);
    }

    const table = await shareService.getTable(shareId, schemaName, tableName);
    if (!table) {
      throw createError('Table not found', 404);
    }

    // Use OSS proxy service
    const metadata = await ossProxyService.getTableMetadata(
      share.name,
      schemaName,
      table.alias || table.name,
      table.location
    );

    res.json({
      success: true,
      data: {
        columns: metadata.columns,
        tableName: metadata.name,
        version: metadata.version,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get table statistics
router.get('/:shareId/schemas/:schemaName/tables/:tableName/stats', requirePermission(Permissions.SHARES_VIEW), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { shareId, schemaName, tableName } = req.params;
    const share = await shareService.getShare(shareId);
    if (!share) {
      throw createError('Share not found', 404);
    }

    const table = await shareService.getTable(shareId, schemaName, tableName);
    if (!table) {
      throw createError('Table not found', 404);
    }

    // Use OSS proxy service
    const stats = await ossProxyService.getTableStats(
      share.name,
      schemaName,
      table.alias || table.name,
      table.location
    );

    res.json({
      success: true,
      data: {
        numRecords: stats.numRecords,
        numFiles: stats.numFiles,
        totalSize: stats.totalSize,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Preview table data (with pagination)
router.get('/:shareId/schemas/:schemaName/tables/:tableName/preview', requirePermission(Permissions.SHARES_VIEW), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { shareId, schemaName, tableName } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
    const offset = parseInt(req.query.offset as string) || 0;
    
    const share = await shareService.getShare(shareId);
    if (!share) {
      throw createError('Share not found', 404);
    }

    const table = await shareService.getTable(shareId, schemaName, tableName);
    if (!table) {
      throw createError('Table not found', 404);
    }

    // Use OSS proxy service
    const result = await ossProxyService.queryTable(
      share.name,
      schemaName,
      table.alias || table.name,
      { limit, offset, tableLocation: table.location }
    );

    res.json({
      success: true,
      data: {
        rows: result.rows,
        totalRows: result.totalRows,
        hasMore: result.hasMore,
        limit,
        offset,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Validate a Delta table location
router.post('/validate-location', requirePermission(Permissions.SHARES_CREATE), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { location } = req.body;
    if (!location) {
      throw createError('Location is required', 400);
    }

    const validation = await validateDeltaTable(location);

    res.json({
      success: true,
      data: validation,
    });
  } catch (error) {
    next(error);
  }
});

// Create a new share
const createShareSchema = z.object({
  name: z.string().min(1).regex(/^[a-zA-Z0-9_]+$/, 'Share name must be alphanumeric with underscores'),
  comment: z.string().optional(),
});

router.post('/', requirePermission(Permissions.SHARES_CREATE), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { name, comment } = createShareSchema.parse(req.body);
    
    const share = await shareService.createShare({
      name,
      comment,
      createdBy: req.user?.email || req.user?.adminId || 'unknown',
    });

    // Sync config to OSS server (if in hybrid mode)
    configSyncService.sync().catch(err => logger.error('Config sync failed', err));

    // Send webhook notification
    webhookService.onShareCreated({
      id: share.id,
      name: share.name,
      createdBy: share.createdBy || undefined,
    }).catch(err => logger.error('Webhook notification failed', err));

    res.status(201).json({
      success: true,
      data: {
        id: share.id,
        name: share.name,
        comment: share.comment,
        createdAt: share.createdAt.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, error.errors));
    }
    // Handle unique constraint violation
    if ((error as any)?.code === 'P2002') {
      return next(createError('Share with this name already exists', 409));
    }
    next(error);
  }
});

// Create a schema in a share
const createSchemaSchema = z.object({
  name: z.string().min(1).regex(/^[a-zA-Z0-9_]+$/, 'Schema name must be alphanumeric with underscores'),
});

router.post('/:shareId/schemas', requirePermission(Permissions.SHARES_CREATE), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { shareId } = req.params;
    const { name } = createSchemaSchema.parse(req.body);

    // Get the share first
    const share = await shareService.getShare(shareId);
    if (!share) {
      throw createError('Share not found', 404);
    }

    const schema = await shareService.createSchema({
      shareId: share.id,
      name,
    });

    // Sync config to OSS server (if in hybrid mode)
    configSyncService.sync().catch(err => logger.error('Config sync failed', err));

    res.status(201).json({
      success: true,
      data: {
        id: schema.id,
        name: schema.name,
        share: share.name,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, error.errors));
    }
    if ((error as any)?.code === 'P2002') {
      return next(createError('Schema with this name already exists in this share', 409));
    }
    next(error);
  }
});

// Create a table in a schema
const createTableSchema = z.object({
  name: z.string().min(1).regex(/^[a-zA-Z0-9_]+$/, 'Table name must be alphanumeric with underscores'),
  location: z.string().min(1, 'Location is required'),
  comment: z.string().optional(),
  alias: z.string().optional(), // Display name shown to recipients (if different from internal name)
});

router.post('/:shareId/schemas/:schemaName/tables', requirePermission(Permissions.SHARES_CREATE), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { shareId, schemaName } = req.params;
    const { name, location, comment, alias } = createTableSchema.parse(req.body);

    // Get the share and schema
    const share = await shareService.getShare(shareId);
    if (!share) {
      throw createError('Share not found', 404);
    }

    const schema = share.schemas.find(s => s.name === schemaName);
    if (!schema) {
      throw createError('Schema not found', 404);
    }

    const table = await shareService.createTable({
      schemaId: schema.id,
      name,
      location,
      comment,
      alias: alias || undefined, // Only set if provided
    });

    // Sync config to OSS server (if in hybrid mode)
    configSyncService.sync().catch(err => logger.error('Config sync failed', err));

    res.status(201).json({
      success: true,
      data: {
        id: table.id,
        name: table.name,
        alias: table.alias,
        displayName: table.alias || table.name, // What recipients will see
        location: table.location,
        schema: schemaName,
        share: share.name,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, error.errors));
    }
    if ((error as any)?.code === 'P2002') {
      return next(createError('Table with this name already exists in this schema', 409));
    }
    next(error);
  }
});

// Delete a share (requires delete permission)
router.delete('/:shareId', requirePermission(Permissions.SHARES_DELETE), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { shareId } = req.params;
    
    const share = await shareService.getShare(shareId);
    if (!share) {
      throw createError('Share not found', 404);
    }

    const shareName = share.name;
    const deleteId = share.id;
    
    await shareService.deleteShare(deleteId);

    // Sync config to OSS server (if in hybrid mode)
    configSyncService.sync().catch(err => logger.error('Config sync failed', err));

    // Send webhook notification
    webhookService.onShareDeleted({
      id: deleteId,
      name: shareName,
    }).catch(err => logger.error('Webhook notification failed', err));

    res.json({
      success: true,
      message: `Share ${shareName} deleted`,
    });
  } catch (error) {
    next(error);
  }
});

// Delete a schema (requires delete permission)
router.delete('/:shareId/schemas/:schemaName', requirePermission(Permissions.SHARES_DELETE), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { shareId, schemaName } = req.params;
    
    const share = await shareService.getShare(shareId);
    if (!share) {
      throw createError('Share not found', 404);
    }

    const schema = share.schemas.find(s => s.name === schemaName);
    if (!schema) {
      throw createError('Schema not found', 404);
    }

    await shareService.deleteSchema(schema.id);

    // Sync config to OSS server (if in hybrid mode)
    configSyncService.sync().catch(err => logger.error('Config sync failed', err));

    res.json({
      success: true,
      message: `Schema ${schemaName} deleted`,
    });
  } catch (error) {
    next(error);
  }
});

// Delete a table (requires delete permission)
router.delete('/:shareId/schemas/:schemaName/tables/:tableName', requirePermission(Permissions.SHARES_DELETE), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { shareId, schemaName, tableName } = req.params;
    
    const table = await shareService.getTable(shareId, schemaName, tableName);
    if (!table) {
      throw createError('Table not found', 404);
    }

    await shareService.deleteTable(table.id);

    // Sync config to OSS server (if in hybrid mode)
    configSyncService.sync().catch(err => logger.error('Config sync failed', err));

    res.json({
      success: true,
      message: `Table ${tableName} deleted`,
    });
  } catch (error) {
    next(error);
  }
});

export { router as sharesRoutes };
