/**
 * Delta Sharing Protocol REST API
 * 
 * This implements the official Delta Sharing REST protocol specification.
 * These endpoints can be used by ANY Delta Sharing client (Python, Spark, etc.)
 * 
 * Protocol Reference: https://github.com/delta-io/delta-sharing/blob/main/PROTOCOL.md
 */

import { Router, Response, NextFunction } from 'express';
import path from 'path';
import { deltaAuth, DeltaAuthenticatedRequest } from '../middleware/deltaAuth.js';
import { shareService } from '../services/shareService.js';
import { getTableMetadata, getTableStats, queryTable, getTableChanges } from '../delta/reader.js';
import { paginate, parsePaginationParams } from '../utils/pagination.js';
import { 
  wantsNDJSON, 
  streamNDJSONResponse,
} from '../utils/ndjson.js';
import { 
  getStorageAdapterForCloudLocation, 
  getStorageAdapter,
  isCloudInternalFormat,
  getRelativePath,
  validateLocalFileToken,
} from '../storage/index.js';
import { logger } from '../utils/logger.js';

const router = Router();

// All Delta protocol routes require bearer token authentication
router.use(deltaAuth);

/**
 * GET /shares
 * List all shares accessible to the recipient
 * 
 * Query params:
 * - maxResults: Maximum number of results (default: 100, max: 1000)
 * - pageToken: Token for pagination
 * 
 * Response format (per protocol):
 * {
 *   "items": [
 *     { "name": "share1", "id": "..." },
 *     { "name": "share2", "id": "..." }
 *   ],
 *   "nextPageToken": "..." // optional
 * }
 */
router.get('/shares', async (req: DeltaAuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const recipientId = req.recipient!.id;
    const paginationParams = parsePaginationParams(req.query as Record<string, unknown>);
    
    const shares = await shareService.listSharesForRecipient(recipientId);
    const mappedShares = shares.map(share => ({
      name: share.name,
      id: share.id,
    }));

    const result = paginate(mappedShares, paginationParams);

    res.json({
      items: result.items,
      ...(result.nextPageToken && { nextPageToken: result.nextPageToken }),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /shares/{share}
 * Get a specific share by name
 */
router.get('/shares/:shareName', async (req: DeltaAuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const recipientId = req.recipient!.id;
    const { shareName } = req.params;

    const hasAccess = await shareService.checkAccess(recipientId, shareName);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this share' });
    }

    const share = await shareService.getShareByName(shareName);
    if (!share) {
      return res.status(404).json({ error: 'Share not found' });
    }

    res.json({
      share: {
        name: share.name,
        id: share.id,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /shares/{share}/schemas
 * List all schemas in a share
 * 
 * Query params:
 * - maxResults: Maximum number of results (default: 100, max: 1000)
 * - pageToken: Token for pagination
 * 
 * Response format:
 * {
 *   "items": [
 *     { "name": "schema1", "share": "share1" },
 *     { "name": "schema2", "share": "share1" }
 *   ],
 *   "nextPageToken": "..." // optional
 * }
 */
router.get('/shares/:shareName/schemas', async (req: DeltaAuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const recipientId = req.recipient!.id;
    const { shareName } = req.params;
    const paginationParams = parsePaginationParams(req.query as Record<string, unknown>);

    const hasAccess = await shareService.checkAccess(recipientId, shareName);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this share' });
    }

    const schemas = await shareService.listSchemas(shareName);
    const mappedSchemas = schemas.map(schema => ({
      name: schema.name,
      share: shareName,
    }));

    const result = paginate(mappedSchemas, paginationParams);

    res.json({
      items: result.items,
      ...(result.nextPageToken && { nextPageToken: result.nextPageToken }),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /shares/{share}/schemas/{schema}/tables
 * List all tables in a schema
 * 
 * Query params:
 * - maxResults: Maximum number of results (default: 100, max: 1000)
 * - pageToken: Token for pagination
 * 
 * Response format:
 * {
 *   "items": [
 *     { "name": "table1", "schema": "schema1", "share": "share1" },
 *     { "name": "table2", "schema": "schema1", "share": "share1" }
 *   ],
 *   "nextPageToken": "..." // optional
 * }
 */
router.get('/shares/:shareName/schemas/:schemaName/tables', async (req: DeltaAuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const recipientId = req.recipient!.id;
    const { shareName, schemaName } = req.params;
    const paginationParams = parsePaginationParams(req.query as Record<string, unknown>);

    const hasAccess = await shareService.checkAccess(recipientId, shareName);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this share' });
    }

    const tables = await shareService.listTables(shareName, schemaName);
    const mappedTables = tables.map(table => ({
      name: table.alias || table.name, // Show alias to recipients
      schema: schemaName,
      share: shareName,
      id: table.id,
    }));

    const result = paginate(mappedTables, paginationParams);

    res.json({
      items: result.items,
      ...(result.nextPageToken && { nextPageToken: result.nextPageToken }),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /shares/{share}/all-tables
 * List all tables across all schemas in a share
 * 
 * Query params:
 * - maxResults: Maximum number of results (default: 100, max: 1000)
 * - pageToken: Token for pagination
 */
router.get('/shares/:shareName/all-tables', async (req: DeltaAuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const recipientId = req.recipient!.id;
    const { shareName } = req.params;
    const paginationParams = parsePaginationParams(req.query as Record<string, unknown>);

    const hasAccess = await shareService.checkAccess(recipientId, shareName);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this share' });
    }

    const share = await shareService.getShareByName(shareName);
    if (!share) {
      return res.status(404).json({ error: 'Share not found' });
    }

    const allTables = share.schemas.flatMap(schema =>
      schema.tables.map(table => ({
        name: table.alias || table.name,
        schema: schema.name,
        share: shareName,
        id: table.id,
      }))
    );

    const result = paginate(allTables, paginationParams);

    res.json({
      items: result.items,
      ...(result.nextPageToken && { nextPageToken: result.nextPageToken }),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /shares/{share}/schemas/{schema}/tables/{table}/version
 * Get the current version of a table
 */
router.get('/shares/:shareName/schemas/:schemaName/tables/:tableName/version', async (req: DeltaAuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const recipientId = req.recipient!.id;
    const { shareName, schemaName, tableName } = req.params;

    const hasAccess = await shareService.checkAccess(recipientId, shareName);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this share' });
    }

    const table = await shareService.getTable(shareName, schemaName, tableName);
    if (!table) {
      return res.status(404).json({ error: 'Table not found' });
    }

    try {
      const metadata = await getTableMetadata(table.location);
      res.setHeader('Delta-Table-Version', metadata.version.toString());
      res.json({ version: metadata.version });
    } catch {
      res.json({ version: 0 });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * GET /shares/{share}/schemas/{schema}/tables/{table}/metadata
 * Get table metadata including schema
 * 
 * Response format (per protocol):
 * {
 *   "protocol": { "minReaderVersion": 1 },
 *   "metadata": {
 *     "id": "...",
 *     "format": { "provider": "parquet" },
 *     "schemaString": "...",
 *     "partitionColumns": []
 *   }
 * }
 */
router.get('/shares/:shareName/schemas/:schemaName/tables/:tableName/metadata', async (req: DeltaAuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const recipientId = req.recipient!.id;
    const { shareName, schemaName, tableName } = req.params;

    const hasAccess = await shareService.checkAccess(recipientId, shareName);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this share' });
    }

    const table = await shareService.getTable(shareName, schemaName, tableName);
    if (!table) {
      return res.status(404).json({ error: 'Table not found' });
    }

    try {
      const metadata = await getTableMetadata(table.location);
      const stats = await getTableStats(table.location);

      const schemaString = JSON.stringify({
        type: 'struct',
        fields: metadata.columns.map(col => ({
          name: col.name,
          type: col.type,
          nullable: col.nullable,
          metadata: {},
        })),
      });

      res.json({
        protocol: {
          minReaderVersion: 1,
        },
        metadata: {
          id: table.id,
          name: table.alias || table.name,
          format: { provider: 'parquet' },
          schemaString,
          partitionColumns: [],
          numFiles: stats.numFiles,
          size: stats.totalSize,
          version: metadata.version,
        },
      });
    } catch (deltaError) {
      logger.error('Failed to read Delta table metadata', deltaError as Error);
      res.json({
        protocol: {
          minReaderVersion: 1,
        },
        metadata: {
          id: table.id,
          name: table.alias || table.name,
          format: { provider: 'parquet' },
          schemaString: '{"type":"struct","fields":[]}',
          partitionColumns: [],
        },
      });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * POST /shares/{share}/schemas/{schema}/tables/{table}/query
 * Query table data
 * 
 * Request body:
 * {
 *   "predicateHints": [...],    // optional (client-side predicates)
 *   "jsonPredicateHints": "...", // optional (JSON predicate format)
 *   "limitHint": 1000,          // optional
 *   "version": 1,               // optional - query specific version (time-travel)
 *   "timestamp": "2024-01-01T00:00:00Z" // optional - query as-of timestamp (time-travel)
 * }
 * 
 * Response format depends on Accept header:
 * - Accept: application/x-ndjson -> NDJSON with pre-signed file URLs (protocol-compliant)
 * - Accept: application/json (default) -> JSON with data rows (UI-friendly)
 * 
 * Access control is enforced using access grants.
 */
router.post('/shares/:shareName/schemas/:schemaName/tables/:tableName/query', async (req: DeltaAuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const recipientId = req.recipient!.id;
    const { shareName, schemaName, tableName } = req.params;
    const { limitHint, offset, version, timestamp } = req.body;

    // Get access grant with permissions
    const accessGrant = await shareService.getAccessGrant(recipientId, shareName);
    if (!accessGrant) {
      return res.status(403).json({ error: 'Access denied to this share' });
    }

    // Check if recipient has query permission
    if (!accessGrant.canQuery) {
      return res.status(403).json({ error: 'Query access not permitted for this recipient' });
    }

    const table = await shareService.getTable(shareName, schemaName, tableName);
    if (!table) {
      return res.status(404).json({ error: 'Table not found' });
    }

    // Check if client wants NDJSON response (protocol-compliant format)
    const useNDJSON = wantsNDJSON(req.headers.accept);

    if (useNDJSON) {
      // NDJSON response: Return pre-signed file URLs per Delta Sharing protocol
      try {
        const metadata = await getTableMetadata(table.location);
        const stats = await getTableStats(table.location);

        // Get storage adapter for generating pre-signed URLs
        let adapter;
        let basePath: string;
        
        if (isCloudInternalFormat(table.location)) {
          const result = await getStorageAdapterForCloudLocation(table.location);
          adapter = result.adapter;
          basePath = result.basePath;
        } else {
          adapter = getStorageAdapter(table.location);
          basePath = getRelativePath(table.location);
        }

        // Read delta log to get active files
        const deltaLogPath = path.join(basePath, '_delta_log');
        const logFiles = await adapter.listFiles(deltaLogPath);
        const commitFiles = logFiles.filter(f => f.endsWith('.json') && /^\d+\.json$/.test(f)).sort();

        // Build file list from delta log
        const activeFiles = new Map<string, { path: string; size: number; stats?: string }>();
        
        for (const commitFile of commitFiles) {
          const filePath = path.join(deltaLogPath, commitFile);
          const content = await adapter.readText(filePath);
          const lines = content.split('\n').filter(line => line.trim());
          
          for (const line of lines) {
            try {
              const entry = JSON.parse(line);
              if (entry.add) {
                activeFiles.set(entry.add.path, {
                  path: entry.add.path,
                  size: entry.add.size,
                  stats: entry.add.stats,
                });
              }
              if (entry.remove) {
                activeFiles.delete(entry.remove.path);
              }
            } catch {
              // Skip malformed lines
            }
          }
        }

        // Generate pre-signed URLs for each file
        const fileActions = [];
        const expiresIn = 3600; // 1 hour
        const expirationTimestamp = Date.now() + expiresIn * 1000;

        for (const [filePath, fileInfo] of activeFiles) {
          const fullPath = path.join(basePath, filePath);
          const presignedUrl = await adapter.generatePresignedUrl(fullPath, expiresIn);
          
          fileActions.push({
            url: presignedUrl,
            id: filePath,
            size: fileInfo.size,
            stats: fileInfo.stats,
            expirationTimestamp,
          });
        }

        // Build schema string
        const schemaString = JSON.stringify({
          type: 'struct',
          fields: metadata.columns.map(col => ({
            name: col.name,
            type: col.type,
            nullable: col.nullable,
            metadata: {},
          })),
        });

        // Stream NDJSON response
        streamNDJSONResponse(
          res,
          { minReaderVersion: 1 },
          {
            id: table.id,
            name: table.alias || table.name,
            format: { provider: 'parquet' },
            schemaString,
            partitionColumns: [],
            version: metadata.version,
            size: stats.totalSize,
            numFiles: stats.numFiles,
          },
          fileActions
        );
      } catch (error) {
        logger.error('Failed to generate NDJSON response', error as Error);
        return res.status(500).json({ error: 'Failed to generate file URLs' });
      }
    } else {
      // JSON response: Return data rows directly (UI-friendly format)
      
      // Determine effective limit
      let limit = Math.min(limitHint || 1000, 10000);
      if (accessGrant.maxRowsPerQuery && limit > accessGrant.maxRowsPerQuery) {
        limit = accessGrant.maxRowsPerQuery;
      }

      // Query the table
      const result = await queryTable(table.location, { 
        limit, 
        offset: offset || 0,
        version: version !== undefined ? Number(version) : undefined,
        timestamp: timestamp as string | undefined,
      });

      res.json({
        rows: result.rows,
        rowCount: result.rows.length,
        hasMore: result.hasMore,
        accessInfo: {
          maxRowsPerQuery: accessGrant.maxRowsPerQuery,
        },
      });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * POST /shares/{share}/schemas/{schema}/tables/{table}/changes
 * Get table changes (Change Data Feed)
 * 
 * Request body:
 * {
 *   "startingVersion": 0,           // optional - starting version (inclusive)
 *   "endingVersion": 10,            // optional - ending version (inclusive)
 *   "startingTimestamp": "...",     // optional - starting timestamp (ISO 8601)
 *   "endingTimestamp": "..."        // optional - ending timestamp (ISO 8601)
 * }
 * 
 * Response: NDJSON stream of change actions (add, remove, cdf file actions)
 */
router.post('/shares/:shareName/schemas/:schemaName/tables/:tableName/changes', async (req: DeltaAuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const recipientId = req.recipient!.id;
    const { shareName, schemaName, tableName } = req.params;
    const { startingVersion, endingVersion, startingTimestamp, endingTimestamp } = req.body;

    // Get access grant with permissions
    const accessGrant = await shareService.getAccessGrant(recipientId, shareName);
    if (!accessGrant) {
      return res.status(403).json({ error: 'Access denied to this share' });
    }

    // Check if recipient has query permission (required for CDF)
    if (!accessGrant.canQuery) {
      return res.status(403).json({ error: 'Query access not permitted for this recipient' });
    }

    const table = await shareService.getTable(shareName, schemaName, tableName);
    if (!table) {
      return res.status(404).json({ error: 'Table not found' });
    }

    try {
      // Get changes from the delta log
      const changes = await getTableChanges(table.location, {
        startingVersion: startingVersion !== undefined ? Number(startingVersion) : undefined,
        endingVersion: endingVersion !== undefined ? Number(endingVersion) : undefined,
        startingTimestamp: startingTimestamp as string | undefined,
        endingTimestamp: endingTimestamp as string | undefined,
      });

      // Get storage adapter for generating pre-signed URLs
      let adapter;
      let basePath: string;
      
      if (isCloudInternalFormat(table.location)) {
        const result = await getStorageAdapterForCloudLocation(table.location);
        adapter = result.adapter;
        basePath = result.basePath;
      } else {
        adapter = getStorageAdapter(table.location);
        basePath = getRelativePath(table.location);
      }

      const expiresIn = 3600;
      const expirationTimestamp = Date.now() + expiresIn * 1000;

      // Build schema string
      let schemaString = '{"type":"struct","fields":[]}';
      if (changes.metadata) {
        schemaString = changes.metadata.schemaString;
      }

      // Set content type for NDJSON
      res.setHeader('Content-Type', 'application/x-ndjson');
      res.setHeader('Transfer-Encoding', 'chunked');
      res.setHeader('Delta-Table-Version', changes.endVersion.toString());

      // Write protocol line
      res.write(JSON.stringify({ protocol: { minReaderVersion: 1 } }) + '\n');

      // Write metadata line
      res.write(JSON.stringify({
        metaData: {
          id: table.id,
          name: table.alias || table.name,
          format: { provider: 'parquet' },
          schemaString,
          partitionColumns: [],
        },
      }) + '\n');

      // Write file action lines for each change
      for (const action of changes.actions) {
        const fullPath = path.join(basePath, action.path);
        let presignedUrl: string;
        
        try {
          presignedUrl = await adapter.generatePresignedUrl(fullPath, expiresIn);
        } catch {
          // If pre-signed URL generation fails, skip this file
          logger.warn(`Failed to generate pre-signed URL for ${fullPath}`);
          continue;
        }

        // Use appropriate action key based on change type
        const actionKey = action.changeType === 'remove' ? 'remove' : 
                         action.changeType === 'cdf' ? 'cdf' : 'add';

        res.write(JSON.stringify({
          [actionKey]: {
            url: presignedUrl,
            id: action.path,
            size: action.size,
            version: action.version,
            timestamp: action.timestamp,
            partitionValues: action.partitionValues,
            stats: action.stats,
            expirationTimestamp,
          },
        }) + '\n');
      }

      res.end();
    } catch (error) {
      logger.error('Failed to get table changes', error as Error);
      return res.status(500).json({ 
        error: 'Failed to retrieve table changes',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * GET /files/:token
 * Download a local file using a pre-signed token
 * This endpoint is used for local file storage when generating pre-signed URLs
 */
router.get('/files/:token', async (req: DeltaAuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { token } = req.params;
    
    const filePath = validateLocalFileToken(token);
    if (!filePath) {
      return res.status(403).json({ error: 'Invalid or expired file token' });
    }

    // Stream the file
    const fs = await import('fs');
    const stat = fs.statSync(filePath);
    
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(filePath)}"`);
    
    const readStream = fs.createReadStream(filePath);
    readStream.pipe(res);
  } catch (error) {
    next(error);
  }
});

export { router as deltaProtocolRoutes };






