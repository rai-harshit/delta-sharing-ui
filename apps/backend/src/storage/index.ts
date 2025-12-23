/**
 * Storage Adapter Factory
 * Creates the appropriate storage adapter based on the path prefix
 */

import { LocalStorageAdapter } from './local.js';
import { S3StorageAdapter } from './s3.js';
import { AzureStorageAdapter } from './azure.js';
import { GCSStorageAdapter } from './gcs.js';
import type { StorageAdapter, StorageConfig } from './types.js';
import { parsePath } from './types.js';

export type { StorageAdapter, StorageConfig } from './types.js';
export { parsePath } from './types.js';
export { LocalStorageAdapter, validateLocalFileToken } from './local.js';
export { S3StorageAdapter } from './s3.js';
export { AzureStorageAdapter } from './azure.js';
export { GCSStorageAdapter } from './gcs.js';

// Cache adapters to avoid recreating them
const adapterCache = new Map<string, StorageAdapter>();

/**
 * Check if a location uses the internal cloud:// format
 */
export function isCloudInternalFormat(location: string): boolean {
  return location.startsWith('cloud://');
}

/**
 * Parse cloud:// internal format
 * Format: cloud://configId/bucket/path
 */
export function parseCloudInternalFormat(location: string): { configId: string; bucket: string; path: string } | null {
  if (!isCloudInternalFormat(location)) {
    return null;
  }
  
  const withoutProtocol = location.replace('cloud://', '');
  const [configId, bucket, ...pathParts] = withoutProtocol.split('/');
  
  if (!configId || !bucket) {
    return null;
  }
  
  return {
    configId,
    bucket,
    path: pathParts.join('/'),
  };
}

/**
 * Get a storage adapter for the given location
 */
export function getStorageAdapter(location: string, config: StorageConfig = { type: 'local' }): StorageAdapter {
  const parsed = parsePath(location);
  
  // Create cache key
  const cacheKey = `${parsed.type}:${parsed.bucket || parsed.container || 'local'}`;
  
  // Return cached adapter if available
  if (adapterCache.has(cacheKey)) {
    return adapterCache.get(cacheKey)!;
  }

  let adapter: StorageAdapter;

  switch (parsed.type) {
    case 'local':
      adapter = new LocalStorageAdapter();
      break;

    case 's3':
      if (!parsed.bucket) {
        throw new Error('S3 path must include bucket name');
      }
      adapter = new S3StorageAdapter(parsed.bucket, config.s3 || {});
      break;

    case 'azure':
      if (!parsed.container || !parsed.account) {
        throw new Error('Azure path must include container and account');
      }
      adapter = new AzureStorageAdapter(parsed.container, parsed.account, config.azure || {});
      break;

    case 'gcs':
      if (!parsed.bucket) {
        throw new Error('GCS path must include bucket name');
      }
      adapter = new GCSStorageAdapter(parsed.bucket, config.gcs || {});
      break;

    default:
      throw new Error(`Unsupported storage type: ${parsed.type}`);
  }

  // Cache and return
  adapterCache.set(cacheKey, adapter);
  return adapter;
}

/**
 * Get the relative path within the storage (without protocol and bucket)
 */
export function getRelativePath(location: string): string {
  const parsed = parsePath(location);
  return parsed.path;
}

/**
 * Get a storage adapter for a cloud:// location, resolving credentials from DB
 * This is the preferred method when working with cloud:// URLs as it properly
 * retrieves and applies stored credentials.
 */
export async function getStorageAdapterForCloudLocation(location: string): Promise<{
  adapter: StorageAdapter;
  resolvedLocation: string;
  basePath: string;
}> {
  if (!isCloudInternalFormat(location)) {
    // Not a cloud:// URL, use regular adapter
    return {
      adapter: getStorageAdapter(location),
      resolvedLocation: location,
      basePath: getRelativePath(location),
    };
  }

  const parsed = parseCloudInternalFormat(location);
  if (!parsed) {
    throw new Error(`Invalid cloud:// location format: ${location}`);
  }

  // Import storage config service (dynamic to avoid circular dependency)
  const { storageConfigService } = await import('../services/storageConfigService.js');
  const config = await storageConfigService.getDecryptedConfig(parsed.configId);
  
  if (!config) {
    throw new Error(`Storage configuration not found for ID: ${parsed.configId}`);
  }

  const cleanPath = parsed.path.replace(/^\/+|\/+$/g, '');
  let resolvedLocation: string;
  let adapter: StorageAdapter;

  if (config.type === 's3') {
    resolvedLocation = cleanPath ? `s3://${parsed.bucket}/${cleanPath}` : `s3://${parsed.bucket}`;
    adapter = new S3StorageAdapter(parsed.bucket, {
      region: config.s3Region || undefined,
      accessKeyId: config.s3AccessKeyId || undefined,
      secretAccessKey: config.s3SecretKey || undefined,
      endpoint: config.s3Endpoint || undefined,
    });
  } else if (config.type === 'azure') {
    if (!config.azureAccount) {
      throw new Error('Azure account not configured');
    }
    resolvedLocation = cleanPath 
      ? `wasbs://${parsed.bucket}@${config.azureAccount}.blob.core.windows.net/${cleanPath}`
      : `wasbs://${parsed.bucket}@${config.azureAccount}.blob.core.windows.net`;
    adapter = new AzureStorageAdapter(parsed.bucket, config.azureAccount, {
      connectionString: config.azureConnectionStr || undefined,
      accountKey: config.azureAccessKey || undefined,
    });
  } else if (config.type === 'gcs') {
    resolvedLocation = cleanPath ? `gs://${parsed.bucket}/${cleanPath}` : `gs://${parsed.bucket}`;
    adapter = new GCSStorageAdapter(parsed.bucket, {
      projectId: config.gcsProjectId || undefined,
    });
  } else {
    throw new Error(`Unknown storage type: ${config.type}`);
  }

  return {
    adapter,
    resolvedLocation,
    basePath: cleanPath,
  };
}
