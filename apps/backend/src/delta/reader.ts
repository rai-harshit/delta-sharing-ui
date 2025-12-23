/**
 * Delta Table Reader
 * Parses Delta Lake transaction logs and reads table data
 */

import path from 'path';
import { 
  getStorageAdapter, 
  getRelativePath, 
  parsePath, 
  isCloudInternalFormat, 
  getStorageAdapterForCloudLocation,
  type StorageAdapter 
} from '../storage/index.js';
import { readParquetFile, readParquetBuffer } from './parquet-reader.js';
import type {
  DeltaLogEntry,
  DeltaTableMetadata,
  DeltaAddAction,
  DeltaSchema,
  Column,
  TableStats,
  TablePreviewResult,
} from './types.js';
import { logger } from '../utils/logger.js';

const DELTA_LOG_DIR = '_delta_log';

/**
 * Options for time-travel queries
 */
export interface TimeTravelOptions {
  version?: number;       // Query specific version
  timestamp?: string;     // Query as-of timestamp (ISO 8601)
}

/**
 * Get storage adapter and resolved location for any location format
 * Handles both cloud:// internal format and standard URLs
 */
async function getAdapterAndPath(location: string): Promise<{
  adapter: StorageAdapter;
  resolvedLocation: string;
  basePath: string;
}> {
  if (isCloudInternalFormat(location)) {
    // Use the new function that properly resolves credentials
    return getStorageAdapterForCloudLocation(location);
  }
  
  // Standard URL format - use existing adapter
  return {
    adapter: getStorageAdapter(location),
    resolvedLocation: location,
    basePath: getRelativePath(location),
  };
}

/**
 * Parse a Delta Lake schema to our Column format
 */
function parseSchema(schemaString: string): Column[] {
  try {
    const schema: DeltaSchema = JSON.parse(schemaString);
    return schema.fields.map(field => ({
      name: field.name,
      type: typeof field.type === 'string' ? field.type : JSON.stringify(field.type),
      nullable: field.nullable,
    }));
  } catch {
    return [];
  }
}

/**
 * Read all commit files and build the table state
 * Supports time-travel by specifying a target version or timestamp
 */
async function readDeltaLog(
  location: string,
  timeTravel?: TimeTravelOptions
): Promise<{
  metadata: DeltaTableMetadata | null;
  activeFiles: DeltaAddAction[];
  version: number;
  resolvedLocation: string;
  adapter: StorageAdapter;
  basePath: string;
}> {
  // Get adapter with proper credentials for cloud:// URLs
  const { adapter, resolvedLocation, basePath } = await getAdapterAndPath(location);
  const deltaLogPath = path.join(basePath, DELTA_LOG_DIR);

  // List all commit files
  const files = await adapter.listFiles(deltaLogPath);
  const commitFiles = files
    .filter(f => f.endsWith('.json') && /^\d+\.json$/.test(f))
    .sort();

  if (commitFiles.length === 0) {
    throw new Error(`No Delta log files found at ${location}`);
  }

  // Parse target timestamp if provided
  const targetTimestamp = timeTravel?.timestamp 
    ? new Date(timeTravel.timestamp).getTime() 
    : null;

  let metadata: DeltaTableMetadata | null = null;
  const activeFiles = new Map<string, DeltaAddAction>();
  let version = -1;

  // Process each commit file in order
  for (const commitFile of commitFiles) {
    // Parse version from filename
    const fileVersion = parseInt(commitFile.replace('.json', ''), 10);
    
    // Stop if we've reached the target version (time-travel by version)
    if (timeTravel?.version !== undefined && fileVersion > timeTravel.version) {
      break;
    }

    const filePath = path.join(deltaLogPath, commitFile);
    const content = await adapter.readText(filePath);

    // Each line is a separate JSON action
    const lines = content.split('\n').filter(line => line.trim());
    
    // Track if this commit should be included (for timestamp-based time-travel)
    let includeCommit = true;
    let commitTimestamp: number | null = null;
    
    for (const line of lines) {
      try {
        const entry: DeltaLogEntry = JSON.parse(line);

        // Check commit timestamp from commitInfo
        if (entry.commitInfo?.timestamp) {
          commitTimestamp = entry.commitInfo.timestamp;
          if (targetTimestamp && commitTimestamp > targetTimestamp) {
            includeCommit = false;
            break; // Stop processing this commit
          }
        }

        if (includeCommit) {
          if (entry.metaData) {
            metadata = entry.metaData;
          }

          if (entry.add) {
            activeFiles.set(entry.add.path, entry.add);
          }

          if (entry.remove) {
            activeFiles.delete(entry.remove.path);
          }
        }
      } catch (e) {
        logger.warn(`Failed to parse Delta log entry`, { error: e });
      }
    }

    // Only update version if we included this commit
    if (includeCommit) {
      version = fileVersion;
    } else {
      // Stop processing further commits if this one exceeded timestamp
      break;
    }
  }

  return {
    metadata,
    activeFiles: Array.from(activeFiles.values()),
    version,
    resolvedLocation,
    adapter,
    basePath,
  };
}

/**
 * Get table metadata
 * Supports time-travel queries via version or timestamp
 */
export async function getTableMetadata(
  location: string,
  timeTravel?: TimeTravelOptions
): Promise<{
  id: string;
  name: string | null;
  description: string | null;
  columns: Column[];
  version: number;
  createdTime: number;
}> {
  const { metadata, version } = await readDeltaLog(location, timeTravel);

  if (!metadata) {
    throw new Error('No metadata found in Delta log');
  }

  return {
    id: metadata.id,
    name: metadata.name,
    description: metadata.description,
    columns: parseSchema(metadata.schemaString),
    version,
    createdTime: metadata.createdTime,
  };
}

/**
 * Get table statistics
 */
export async function getTableStats(location: string): Promise<TableStats> {
  const { activeFiles } = await readDeltaLog(location);

  let numRecords = 0;
  let totalSize = 0;

  for (const file of activeFiles) {
    totalSize += file.size;

    // Try to parse stats from the file entry
    if (file.stats) {
      try {
        const stats = JSON.parse(file.stats);
        numRecords += stats.numRecords || 0;
      } catch {
        // Ignore stats parsing errors
      }
    }
  }

  return {
    numRecords,
    numFiles: activeFiles.length,
    totalSize,
  };
}

/**
 * Query table data (read from data files)
 * Supports time-travel queries via version or timestamp
 */
export async function queryTable(
  location: string,
  options: { 
    limit?: number; 
    offset?: number;
    version?: number;
    timestamp?: string;
  } = {}
): Promise<TablePreviewResult> {
  const { limit = 100, offset = 0, version, timestamp } = options;

  // Build time-travel options
  const timeTravel: TimeTravelOptions | undefined = 
    (version !== undefined || timestamp) ? { version, timestamp } : undefined;

  // Get adapter with credentials and all file info from readDeltaLog
  const { metadata, activeFiles, resolvedLocation, adapter, basePath } = await readDeltaLog(location, timeTravel);

  if (!metadata) {
    throw new Error('No metadata found in Delta log');
  }

  const columns = parseSchema(metadata.schemaString);
  const allRows: Record<string, unknown>[] = [];

  // Read data from each active file
  for (const file of activeFiles) {
    const dataFilePath = path.join(basePath, file.path);

    try {
      if (file.path.endsWith('.json')) {
        // Read JSON data files
        const data = await adapter.readJson<Record<string, unknown>[]>(dataFilePath);
        allRows.push(...data);
      } else if (file.path.endsWith('.parquet')) {
        // Read Parquet data files
        try {
          // Check if it's a local file or cloud storage
          const parsed = parsePath(resolvedLocation);
          
          if (parsed.type === 'local') {
            // For local files, read directly
            const result = await readParquetFile(dataFilePath);
            allRows.push(...result.rows);
          } else {
            // For cloud storage, read as buffer first
            const buffer = await adapter.readFile(dataFilePath);
            const result = await readParquetBuffer(buffer);
            allRows.push(...result.rows);
          }
        } catch (parquetError) {
          logger.error(`Failed to read Parquet file ${dataFilePath}`, parquetError as Error);
        }
      }
    } catch (e) {
      logger.error(`Failed to read data file ${dataFilePath}`, e as Error);
    }
  }

  const totalRows = allRows.length;
  const paginatedRows = allRows.slice(offset, offset + limit);

  return {
    columns,
    rows: paginatedRows,
    totalRows,
    hasMore: offset + limit < totalRows,
  };
}

/**
 * Validate that a path contains a valid Delta table
 */
export async function validateDeltaTable(location: string): Promise<{
  valid: boolean;
  error?: string;
  metadata?: {
    name: string | null;
    columns: Column[];
    rowCount: number;
  };
}> {
  try {
    // Get adapter with proper credentials for cloud:// URLs
    const { adapter, resolvedLocation, basePath } = await getAdapterAndPath(location);
    const deltaLogPath = path.join(basePath, DELTA_LOG_DIR);

    // Check if _delta_log directory exists
    const exists = await adapter.exists(deltaLogPath);
    if (!exists) {
      // Try listing files to see if it's a directory
      const files = await adapter.listFiles(deltaLogPath);
      if (files.length === 0) {
        return {
          valid: false,
          error: `No Delta log found at ${resolvedLocation}. Path should contain a _delta_log directory.`,
        };
      }
    }

    // Try to read metadata (use original location to reuse our adapter logic)
    const { metadata, activeFiles } = await readDeltaLog(location);

    if (!metadata) {
      return {
        valid: false,
        error: 'Delta log exists but contains no metadata.',
      };
    }

    // Get row count from stats
    let rowCount = 0;
    for (const file of activeFiles) {
      if (file.stats) {
        try {
          const stats = JSON.parse(file.stats);
          rowCount += stats.numRecords || 0;
        } catch {
          // Ignore
        }
      }
    }

    return {
      valid: true,
      metadata: {
        name: metadata.name,
        columns: parseSchema(metadata.schemaString),
        rowCount,
      },
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown error validating Delta table',
    };
  }
}

/**
 * Options for Change Data Feed queries
 */
export interface CDFQueryOptions {
  startingVersion?: number;
  endingVersion?: number;
  startingTimestamp?: string;
  endingTimestamp?: string;
}

/**
 * Change action types for CDF
 */
export interface CDFFileAction {
  path: string;
  size: number;
  version: number;
  timestamp: number;
  changeType: 'add' | 'remove' | 'cdf';
  partitionValues?: Record<string, string>;
  stats?: string;
}

/**
 * Result of a CDF query
 */
export interface CDFResult {
  metadata: DeltaTableMetadata | null;
  actions: CDFFileAction[];
  startVersion: number;
  endVersion: number;
}

/**
 * Get table changes between versions (Change Data Feed)
 * Returns add, remove, and cdf file actions for the specified version range
 */
export async function getTableChanges(
  location: string,
  options: CDFQueryOptions = {}
): Promise<CDFResult> {
  const { adapter, basePath } = await getAdapterAndPath(location);
  const deltaLogPath = path.join(basePath, DELTA_LOG_DIR);

  // List all commit files
  const files = await adapter.listFiles(deltaLogPath);
  const commitFiles = files
    .filter(f => f.endsWith('.json') && /^\d+\.json$/.test(f))
    .sort();

  if (commitFiles.length === 0) {
    throw new Error(`No Delta log files found at ${location}`);
  }

  // Parse timestamps to epoch ms if provided
  const startTimestamp = options.startingTimestamp
    ? new Date(options.startingTimestamp).getTime()
    : null;
  const endTimestamp = options.endingTimestamp
    ? new Date(options.endingTimestamp).getTime()
    : null;

  let metadata: DeltaTableMetadata | null = null;
  const actions: CDFFileAction[] = [];
  let startVersion = -1;
  let endVersion = -1;
  let foundStart = false;

  // Process each commit file
  for (const commitFile of commitFiles) {
    const fileVersion = parseInt(commitFile.replace('.json', ''), 10);
    
    // Determine if this version should be included
    let includeVersion = false;
    let commitTimestamp: number | null = null;

    // Read the commit file to get timestamp
    const filePath = path.join(deltaLogPath, commitFile);
    const content = await adapter.readText(filePath);
    const lines = content.split('\n').filter(line => line.trim());

    // First pass: find commitInfo for timestamp
    for (const line of lines) {
      try {
        const entry: DeltaLogEntry = JSON.parse(line);
        if (entry.commitInfo?.timestamp) {
          commitTimestamp = entry.commitInfo.timestamp;
          break;
        }
      } catch {
        // Skip malformed lines
      }
    }

    // Check version-based filtering
    if (options.startingVersion !== undefined) {
      if (fileVersion >= options.startingVersion) {
        foundStart = true;
      }
      if (options.endingVersion !== undefined && fileVersion > options.endingVersion) {
        break; // Past end version
      }
      includeVersion = foundStart && (options.endingVersion === undefined || fileVersion <= options.endingVersion);
    }
    // Check timestamp-based filtering
    else if (startTimestamp !== null && commitTimestamp !== null) {
      if (commitTimestamp >= startTimestamp) {
        foundStart = true;
      }
      if (endTimestamp !== null && commitTimestamp > endTimestamp) {
        break; // Past end timestamp
      }
      includeVersion = foundStart && (endTimestamp === null || commitTimestamp <= endTimestamp);
    }
    // No filters: include all versions
    else {
      includeVersion = true;
      foundStart = true;
    }

    if (!includeVersion) continue;

    // Track version range
    if (startVersion === -1) startVersion = fileVersion;
    endVersion = fileVersion;

    // Second pass: extract actions
    for (const line of lines) {
      try {
        const entry: DeltaLogEntry = JSON.parse(line);

        if (entry.metaData) {
          metadata = entry.metaData;
        }

        if (entry.add) {
          actions.push({
            path: entry.add.path,
            size: entry.add.size,
            version: fileVersion,
            timestamp: entry.add.modificationTime || commitTimestamp || 0,
            changeType: 'add',
            partitionValues: entry.add.partitionValues,
            stats: entry.add.stats,
          });
        }

        if (entry.remove) {
          actions.push({
            path: entry.remove.path,
            size: entry.remove.size || 0,
            version: fileVersion,
            timestamp: entry.remove.deletionTimestamp || commitTimestamp || 0,
            changeType: 'remove',
            partitionValues: entry.remove.partitionValues,
          });
        }

        // Look for CDF-specific files (from Delta Lake's CDF feature)
        // These are typically stored in _change_data directory
        if (entry.add?.path?.includes('_change_data/')) {
          // Re-classify as CDF action
          const lastAction = actions[actions.length - 1];
          if (lastAction && lastAction.path === entry.add.path) {
            lastAction.changeType = 'cdf';
          }
        }
      } catch {
        // Skip malformed lines
      }
    }
  }

  return {
    metadata,
    actions,
    startVersion: startVersion === -1 ? 0 : startVersion,
    endVersion: endVersion === -1 ? 0 : endVersion,
  };
}
