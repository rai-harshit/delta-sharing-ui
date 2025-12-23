/**
 * Storage Adapter Interface
 * Provides a unified interface for reading from different storage backends
 */

export interface StorageAdapter {
  /**
   * List files in a directory
   */
  listFiles(dirPath: string): Promise<string[]>;

  /**
   * Check if a path exists
   */
  exists(filePath: string): Promise<boolean>;

  /**
   * Read file contents as Buffer
   */
  readFile(filePath: string): Promise<Buffer>;

  /**
   * Read file contents as string
   */
  readText(filePath: string): Promise<string>;

  /**
   * Read JSON file and parse
   */
  readJson<T = unknown>(filePath: string): Promise<T>;

  /**
   * Get file size in bytes
   */
  getFileSize(filePath: string): Promise<number>;

  /**
   * Generate a pre-signed URL for downloading a file
   * @param filePath Path to the file
   * @param expiresInSeconds How long the URL should be valid (default: 3600)
   * @returns Pre-signed URL string
   */
  generatePresignedUrl(filePath: string, expiresInSeconds?: number): Promise<string>;
}

export interface StorageConfig {
  type: 'local' | 's3' | 'azure' | 'gcs';
  // S3 config
  s3?: {
    region?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    endpoint?: string;
  };
  // Azure config
  azure?: {
    connectionString?: string;
    accountName?: string;
    accountKey?: string;
  };
  // GCS config
  gcs?: {
    projectId?: string;
    keyFilename?: string;
  };
}

/**
 * Parse a storage path and determine the storage type
 * Examples:
 *   file:///path/to/table -> { type: 'local', path: '/path/to/table' }
 *   s3://bucket/prefix -> { type: 's3', bucket: 'bucket', path: 'prefix' }
 *   abfss://container@account/path -> { type: 'azure', container: 'container', account: 'account', path: 'path' }
 *   gs://bucket/path -> { type: 'gcs', bucket: 'bucket', path: 'path' }
 */
export interface ParsedPath {
  type: 'local' | 's3' | 'azure' | 'gcs';
  path: string;
  bucket?: string;
  container?: string;
  account?: string;
}

export function parsePath(location: string): ParsedPath {
  // Local filesystem
  if (location.startsWith('file://')) {
    return {
      type: 'local',
      path: location.replace('file://', ''),
    };
  }
  
  // Also treat absolute paths as local
  if (location.startsWith('/') || location.startsWith('./') || location.startsWith('../')) {
    return {
      type: 'local',
      path: location,
    };
  }

  // S3
  if (location.startsWith('s3://') || location.startsWith('s3a://')) {
    const withoutProtocol = location.replace(/^s3a?:\/\//, '');
    const [bucket, ...pathParts] = withoutProtocol.split('/');
    return {
      type: 's3',
      bucket,
      path: pathParts.join('/'),
    };
  }

  // Azure Blob Storage (abfss://, wasbs://, abfs://)
  if (location.match(/^(abfss?|wasbs?):\/\//)) {
    const withoutProtocol = location.replace(/^(abfss?|wasbs?):\/\//, '');
    // Format: container@account.dfs.core.windows.net/path
    const match = withoutProtocol.match(/^([^@]+)@([^.]+)\..*?\/(.*)$/);
    if (match) {
      return {
        type: 'azure',
        container: match[1],
        account: match[2],
        path: match[3],
      };
    }
    // Simpler format: container/path
    const [container, ...pathParts] = withoutProtocol.split('/');
    return {
      type: 'azure',
      container,
      path: pathParts.join('/'),
    };
  }

  // Google Cloud Storage
  if (location.startsWith('gs://')) {
    const withoutProtocol = location.replace('gs://', '');
    const [bucket, ...pathParts] = withoutProtocol.split('/');
    return {
      type: 'gcs',
      bucket,
      path: pathParts.join('/'),
    };
  }

  // Default to local for relative paths
  return {
    type: 'local',
    path: location,
  };
}
