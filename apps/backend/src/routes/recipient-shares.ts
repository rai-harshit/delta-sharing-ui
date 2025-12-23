import { Router, Response, NextFunction } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';
import { createError } from '../middleware/errorHandler.js';
import { shareService } from '../services/shareService.js';
import { ossProxyService } from '../services/ossProxyService.js';
import { logger } from '../utils/logger.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Helper to ensure this is a recipient request
const ensureRecipient = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user?.recipientId) {
    throw createError('This endpoint is only available to recipients', 403);
  }
  next();
};

router.use(ensureRecipient);

// List shares accessible to this recipient
router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const recipientId = req.user!.recipientId!;
    const shares = await shareService.listSharesForRecipient(recipientId);

    // Format response with full hierarchy
    // Recipients see alias as the table name if set
    const data = shares.map(share => ({
      id: share.id,
      name: share.name,
      comment: share.comment,
      schemas: share.schemas.map(schema => ({
        name: schema.name,
        tables: schema.tables.map(table => ({
          name: table.alias || table.name, // Show alias to recipients
          share: share.name,
          schema: schema.name,
        })),
      })),
    }));

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
});

// Get details of a specific share (if recipient has access)
router.get('/:shareName', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const recipientId = req.user!.recipientId!;
    const { shareName } = req.params;

    // Check access
    const hasAccess = await shareService.checkAccess(recipientId, shareName);
    if (!hasAccess) {
      throw createError('Access denied to this share', 403);
    }

    const share = await shareService.getShareByName(shareName);
    if (!share) {
      throw createError('Share not found', 404);
    }

    res.json({
      success: true,
      data: {
        id: share.id,
        name: share.name,
        comment: share.comment,
        schemas: share.schemas.map(s => ({
          name: s.name,
          tables: s.tables.map(t => ({
            name: t.alias || t.name, // Show alias to recipients
            comment: t.comment,
          })),
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get schemas for a share
router.get('/:shareName/schemas', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const recipientId = req.user!.recipientId!;
    const { shareName } = req.params;

    const hasAccess = await shareService.checkAccess(recipientId, shareName);
    if (!hasAccess) {
      throw createError('Access denied to this share', 403);
    }

    const schemas = await shareService.listSchemas(shareName);

    res.json({
      success: true,
      data: schemas.map(s => ({
        name: s.name,
        share: shareName,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// Get tables for a schema
router.get('/:shareName/schemas/:schemaName/tables', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const recipientId = req.user!.recipientId!;
    const { shareName, schemaName } = req.params;

    const hasAccess = await shareService.checkAccess(recipientId, shareName);
    if (!hasAccess) {
      throw createError('Access denied to this share', 403);
    }

    const tables = await shareService.listTables(shareName, schemaName);

    res.json({
      success: true,
      data: tables.map(t => ({
        name: t.alias || t.name, // Show alias to recipients
        schema: schemaName,
        share: shareName,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// Get table metadata (reads from actual Delta table)
router.get('/:shareName/schemas/:schemaName/tables/:tableName/metadata', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const recipientId = req.user!.recipientId!;
    const { shareName, schemaName, tableName } = req.params;

    const hasAccess = await shareService.checkAccess(recipientId, shareName);
    if (!hasAccess) {
      throw createError('Access denied to this share', 403);
    }

    const table = await shareService.getTable(shareName, schemaName, tableName);
    if (!table) {
      throw createError('Table not found', 404);
    }

    try {
      // Use OSS proxy service
      const metadata = await ossProxyService.getTableMetadata(
        shareName,
        schemaName,
        table.alias || table.name,
        table.location
      );
      const stats = await ossProxyService.getTableStats(
        shareName,
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

// Preview table data (with pagination)
router.get('/:shareName/schemas/:schemaName/tables/:tableName/preview', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const recipientId = req.user!.recipientId!;
    const { shareName, schemaName, tableName } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
    const offset = parseInt(req.query.offset as string) || 0;

    const hasAccess = await shareService.checkAccess(recipientId, shareName);
    if (!hasAccess) {
      throw createError('Access denied to this share', 403);
    }

    const table = await shareService.getTable(shareName, schemaName, tableName);
    if (!table) {
      throw createError('Table not found', 404);
    }

    // Use OSS proxy service
    const result = await ossProxyService.queryTable(
      shareName,
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

export { router as recipientSharesRoutes };

