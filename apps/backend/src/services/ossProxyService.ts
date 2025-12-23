/**
 * OSS Proxy Service
 * 
 * Routes data operations to either the OSS Delta Sharing server (hybrid mode)
 * or the custom Delta reader (standalone mode).
 * 
 * In hybrid mode:
 * - Uses a system service account token to authenticate with OSS server
 * - Fetches file URLs from query responses and reads parquet data
 * - Provides a unified interface matching the custom reader API
 * 
 * In standalone mode:
 * - Falls back to the custom Delta reader
 */

import { prisma } from '../db/client.js';
import { DeltaSharingClient, QueryTableResult, CDFQueryOptions, CDFResult } from './deltaClient.js';
import { configSyncService } from './configSyncService.js';
import { recipientService } from './recipientService.js';
import { readParquetBuffer } from '../delta/parquet-reader.js';
import { logger } from '../utils/logger.js';
import {
  getTableMetadata as customGetTableMetadata,
  getTableStats as customGetTableStats,
  queryTable as customQueryTable,
  getTableChanges as customGetTableChanges,
} from '../delta/reader.js';
import crypto from 'crypto';
import { getEncryptionKeyString } from '../utils/encryption.js';

// System recipient name (internal use only)
const SYSTEM_RECIPIENT_NAME = '__system__';

// Cache the client instance
let ossClient: DeltaSharingClient | null = null;
let systemTokenPlain: string | null = null;

/**
 * Encrypt a string using AES-256-GCM
 */
function encrypt(text: string): string {
  const key = crypto.scryptSync(getEncryptionKeyString(), 'delta-salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

/**
 * Decrypt a string using AES-256-GCM
 */
function decrypt(encryptedText: string): string {
  const parts = encryptedText.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted format');
  }
  
  const key = crypto.scryptSync(getEncryptionKeyString(), 'delta-salt', 32);
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];
  
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Column type from parsed schema
 */
export interface Column {
  name: string;
  type: string;
  nullable: boolean;
}

/**
 * Result from metadata request
 */
export interface TableMetadataResult {
  id: string;
  name: string | null;
  description: string | null;
  columns: Column[];
  version: number;
  createdTime: number;
  numFiles?: number;
  totalSize?: number;
}

/**
 * Result from stats request
 */
export interface TableStatsResult {
  numRecords: number;
  numFiles: number;
  totalSize: number;
}

/**
 * Result from query/preview request
 */
export interface TablePreviewResult {
  columns: Column[];
  rows: Record<string, unknown>[];
  totalRows: number;
  hasMore: boolean;
}

/**
 * Parse schema string to Column array
 */
function parseSchemaString(schemaString: string): Column[] {
  try {
    const schema = JSON.parse(schemaString);
    if (schema.fields && Array.isArray(schema.fields)) {
      return schema.fields.map((field: { name: string; type: unknown; nullable: boolean }) => ({
        name: field.name,
        type: typeof field.type === 'string' ? field.type : JSON.stringify(field.type),
        nullable: field.nullable,
      }));
    }
    return [];
  } catch {
    return [];
  }
}

export const ossProxyService = {
  /**
   * Check if we're in hybrid mode
   */
  isHybridMode(): boolean {
    return configSyncService.isHybridMode();
  },

  /**
   * Get the OSS server URL
   */
  getOSSServerUrl(): string {
    return process.env.OSS_SERVER_URL || 'http://delta-sharing-oss:8080';
  },

  /**
   * Ensure the system recipient exists and has access to all shares
   * Returns the plain-text token for internal use
   */
  async ensureSystemToken(): Promise<string> {
    // Return cached token if available
    if (systemTokenPlain) {
      return systemTokenPlain;
    }

    // Check if we have a stored token
    const config = await prisma.systemConfig.findUnique({
      where: { id: 'system' },
    });

    if (config?.adminToken && config?.adminRecipientId) {
      // Verify the recipient still exists
      const recipient = await prisma.recipient.findUnique({
        where: { id: config.adminRecipientId },
        include: { tokens: { where: { isActive: true } } },
      });

      if (recipient && recipient.tokens.length > 0) {
        // Decrypt and cache the token
        try {
          systemTokenPlain = decrypt(config.adminToken);
          return systemTokenPlain;
        } catch {
          // Token decryption failed, regenerate
          logger.warn('System token decryption failed, regenerating...');
        }
      }
    }

    // Create or update the system recipient
    const endpoint = process.env.DELTA_SHARING_ENDPOINT || 'http://localhost/delta';
    
    // Check if recipient already exists
    let recipient = await prisma.recipient.findUnique({
      where: { name: SYSTEM_RECIPIENT_NAME },
    });

    if (!recipient) {
      // Create new system recipient
      const result = await recipientService.createRecipient(
        {
          name: SYSTEM_RECIPIENT_NAME,
          comment: 'Internal system service account - DO NOT DELETE',
        },
        endpoint
      );
      recipient = result.recipient;
      systemTokenPlain = result.credential.bearerToken;
    } else {
      // Rotate the token to get a fresh one
      const result = await recipientService.rotateToken(recipient.id, endpoint);
      systemTokenPlain = result.bearerToken;
    }

    // Ensure we have a valid token
    if (!systemTokenPlain) {
      throw new Error('Failed to obtain system token');
    }

    // Grant access to all existing shares
    await this.grantSystemAccessToAllShares(recipient.id);

    // Store encrypted token in system config
    await prisma.systemConfig.upsert({
      where: { id: 'system' },
      create: {
        id: 'system',
        adminToken: encrypt(systemTokenPlain),
        adminRecipientId: recipient.id,
      },
      update: {
        adminToken: encrypt(systemTokenPlain),
        adminRecipientId: recipient.id,
      },
    });

    return systemTokenPlain;
  },

  /**
   * Grant the system recipient access to all shares
   */
  async grantSystemAccessToAllShares(recipientId: string): Promise<void> {
    const shares = await prisma.share.findMany({ select: { id: true } });
    
    for (const share of shares) {
      await prisma.accessGrant.upsert({
        where: {
          recipientId_shareId: {
            recipientId,
            shareId: share.id,
          },
        },
        create: {
          recipientId,
          shareId: share.id,
          grantedBy: 'system',
        },
        update: {},
      });
    }
  },

  /**
   * Get OSS client instance (cached)
   */
  async getClient(): Promise<DeltaSharingClient> {
    if (!this.isHybridMode()) {
      throw new Error('OSS client only available in hybrid mode');
    }

    if (!ossClient) {
      const token = await this.ensureSystemToken();
      ossClient = new DeltaSharingClient(this.getOSSServerUrl(), token);
    }

    return ossClient;
  },

  /**
   * Clear cached client (useful when token changes)
   */
  clearClientCache(): void {
    ossClient = null;
    systemTokenPlain = null;
  },

  /**
   * Get table metadata
   * In hybrid mode: queries OSS server
   * In standalone mode: uses custom reader
   */
  async getTableMetadata(
    shareName: string,
    schemaName: string,
    tableName: string,
    tableLocation?: string
  ): Promise<TableMetadataResult> {
    if (this.isHybridMode()) {
      const client = await this.getClient();
      const metadata = await client.getTableMetadata(shareName, schemaName, tableName);
      
      return {
        id: tableName,
        name: tableName,
        description: null,
        columns: parseSchemaString(metadata.schemaString),
        version: metadata.version || 0,
        createdTime: Date.now(),
        numFiles: metadata.numFiles,
        totalSize: metadata.size,
      };
    }

    // Standalone mode: use custom reader
    if (!tableLocation) {
      throw new Error('Table location required in standalone mode');
    }

    const metadata = await customGetTableMetadata(tableLocation);
    const stats = await customGetTableStats(tableLocation);

    return {
      id: metadata.id,
      name: metadata.name,
      description: metadata.description,
      columns: metadata.columns,
      version: metadata.version,
      createdTime: metadata.createdTime,
      numFiles: stats.numFiles,
      totalSize: stats.totalSize,
    };
  },

  /**
   * Get table statistics
   * In hybrid mode: derives from metadata
   * In standalone mode: uses custom reader
   */
  async getTableStats(
    shareName: string,
    schemaName: string,
    tableName: string,
    tableLocation?: string
  ): Promise<TableStatsResult> {
    if (this.isHybridMode()) {
      const client = await this.getClient();
      const metadata = await client.getTableMetadata(shareName, schemaName, tableName);
      
      return {
        numRecords: 0, // OSS metadata doesn't include row count
        numFiles: metadata.numFiles || 0,
        totalSize: metadata.size || 0,
      };
    }

    // Standalone mode: use custom reader
    if (!tableLocation) {
      throw new Error('Table location required in standalone mode');
    }

    return customGetTableStats(tableLocation);
  },

  /**
   * Query/preview table data
   * In hybrid mode: fetches file URLs from OSS, downloads and reads parquet
   * In standalone mode: uses custom reader
   */
  async queryTable(
    shareName: string,
    schemaName: string,
    tableName: string,
    options: {
      limit?: number;
      offset?: number;
      tableLocation?: string;
    } = {}
  ): Promise<TablePreviewResult> {
    const { limit = 100, offset = 0, tableLocation } = options;

    if (this.isHybridMode()) {
      const client = await this.getClient();
      
      // Get file URLs from OSS server
      const queryResult = await client.queryTableRaw(shareName, schemaName, tableName, {
        limitHint: limit + offset, // Request enough rows for offset + limit
      });

      // Parse schema from metadata
      const columns = queryResult.metadata 
        ? parseSchemaString(queryResult.metadata.schemaString)
        : [];

      // Fetch and parse parquet data from file URLs
      const allRows: Record<string, unknown>[] = [];
      
      for (const file of queryResult.files) {
        if (allRows.length >= limit + offset) break;

        try {
          // Fetch the parquet file from the pre-signed URL
          const response = await fetch(file.url);
          if (!response.ok) {
            logger.error(`Failed to fetch file ${file.id}: ${response.statusText}`);
            continue;
          }

          const buffer = await response.arrayBuffer();
          const parquetResult = await readParquetBuffer(Buffer.from(buffer));
          allRows.push(...parquetResult.rows);
        } catch (error) {
          logger.error(`Failed to read parquet file ${file.id}`, error as Error);
        }
      }

      // Apply offset and limit
      const paginatedRows = allRows.slice(offset, offset + limit);

      return {
        columns,
        rows: paginatedRows,
        totalRows: allRows.length,
        hasMore: allRows.length > offset + limit,
      };
    }

    // Standalone mode: use custom reader
    if (!tableLocation) {
      throw new Error('Table location required in standalone mode');
    }

    return customQueryTable(tableLocation, { limit, offset });
  },

  /**
   * Get the raw query result from OSS server (with file URLs)
   * Only available in hybrid mode
   */
  async queryTableRaw(
    shareName: string,
    schemaName: string,
    tableName: string,
    options: { limitHint?: number } = {}
  ): Promise<QueryTableResult> {
    if (!this.isHybridMode()) {
      throw new Error('queryTableRaw only available in hybrid mode');
    }

    const client = await this.getClient();
    return client.queryTableRaw(shareName, schemaName, tableName, options);
  },

  /**
   * Query table changes (Change Data Feed)
   * In hybrid mode: queries OSS server
   * In standalone mode: uses custom reader
   */
  async queryTableChanges(
    shareName: string,
    schemaName: string,
    tableName: string,
    options: CDFQueryOptions & { tableLocation?: string } = {}
  ): Promise<CDFResult> {
    const { tableLocation, ...cdfOptions } = options;

    if (this.isHybridMode()) {
      const client = await this.getClient();
      return client.queryTableChanges(shareName, schemaName, tableName, cdfOptions);
    }

    // Standalone mode: use custom reader
    if (!tableLocation) {
      throw new Error('Table location required in standalone mode');
    }

    const changes = await customGetTableChanges(tableLocation, cdfOptions);

    // Convert to CDFResult format
    return {
      protocol: { minReaderVersion: 1 },
      metadata: changes.metadata ? {
        id: tableName,
        format: { provider: 'parquet' },
        schemaString: changes.metadata.schemaString,
        partitionColumns: [],
      } : null,
      actions: changes.actions.map(action => {
        const actionType = action.changeType;
        const actionData = {
          url: '', // URL would need to be generated with pre-signed URLs
          id: action.path,
          size: action.size,
          version: action.version,
          timestamp: action.timestamp,
          partitionValues: action.partitionValues,
          stats: action.stats,
        };

        if (actionType === 'remove') {
          return { remove: actionData };
        } else if (actionType === 'cdf') {
          return { cdf: actionData };
        } else {
          return { add: actionData };
        }
      }),
    };
  },

  /**
   * Initialize the service on startup
   * Creates system token if in hybrid mode
   */
  async initialize(): Promise<void> {
    if (this.isHybridMode()) {
      logger.info('Initializing OSS proxy in hybrid mode');
      try {
        await this.ensureSystemToken();
        logger.info('OSS proxy system token initialized');
      } catch (error) {
        logger.error('Failed to initialize OSS proxy system token', error);
      }
    } else {
      logger.info('OSS proxy running in standalone mode');
    }
  },

  /**
   * Refresh system token access when shares change
   */
  async refreshSystemAccess(): Promise<void> {
    if (!this.isHybridMode()) return;

    const config = await prisma.systemConfig.findUnique({
      where: { id: 'system' },
    });

    if (config?.adminRecipientId) {
      await this.grantSystemAccessToAllShares(config.adminRecipientId);
    }
  },
};


