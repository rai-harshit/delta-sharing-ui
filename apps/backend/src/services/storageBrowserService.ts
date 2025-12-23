/**
 * Storage Browser Service
 * Handles browsing cloud storage and detecting Delta tables
 */

import { storageConfigService } from './storageConfigService.js';
import { ossProxyService } from './ossProxyService.js';
import { logger } from '../utils/logger.js';

export interface BucketInfo {
  name: string;
  createdAt?: Date;
}

export interface FileInfo {
  name: string;
  path: string;
  type: 'file' | 'folder';
  size?: number;
  lastModified?: Date;
}

export interface DeltaTableInfo {
  name: string;
  location: string;
  version: number;
  numFiles: number;
  sizeBytes: number;
}

export const storageBrowserService = {
  /**
   * List all buckets/containers for a storage configuration
   */
  async listBuckets(configId: string): Promise<BucketInfo[]> {
    const config = await storageConfigService.getDecryptedConfig(configId);
    if (!config) {
      throw new Error('Storage configuration not found');
    }

    if (config.type === 's3') {
      const { S3Client, ListBucketsCommand } = await import('@aws-sdk/client-s3');
      
      const credentials = config.s3AccessKeyId && config.s3SecretKey
        ? { accessKeyId: config.s3AccessKeyId, secretAccessKey: config.s3SecretKey }
        : undefined;

      const client = new S3Client({
        region: config.s3Region || 'us-east-1',
        credentials,
        endpoint: config.s3Endpoint || undefined,
        forcePathStyle: !!config.s3Endpoint,
      });

      const response = await client.send(new ListBucketsCommand({}));
      return (response.Buckets || []).map(b => ({
        name: b.Name || '',
        createdAt: b.CreationDate,
      })).filter(b => b.name);
    }

    if (config.type === 'azure') {
      const { BlobServiceClient, StorageSharedKeyCredential } = await import('@azure/storage-blob');
      
      let serviceClient: InstanceType<typeof BlobServiceClient>;

      if (config.azureConnectionStr) {
        serviceClient = BlobServiceClient.fromConnectionString(config.azureConnectionStr);
      } else if (config.azureAccount && config.azureAccessKey) {
        const credential = new StorageSharedKeyCredential(config.azureAccount, config.azureAccessKey);
        serviceClient = new BlobServiceClient(
          `https://${config.azureAccount}.blob.core.windows.net`,
          credential
        );
      } else {
        throw new Error('Azure credentials not configured');
      }

      const buckets: BucketInfo[] = [];
      for await (const container of serviceClient.listContainers()) {
        buckets.push({
          name: container.name,
          createdAt: container.properties.lastModified,
        });
      }

      return buckets;
    }

    if (config.type === 'gcs') {
      const { Storage } = await import('@google-cloud/storage');
      
      let storage: InstanceType<typeof Storage>;

      if (config.gcsKeyFile) {
        const credentials = JSON.parse(config.gcsKeyFile);
        storage = new Storage({
          projectId: config.gcsProjectId || credentials.project_id,
          credentials,
        });
      } else {
        storage = new Storage({
          projectId: config.gcsProjectId,
        });
      }

      const [buckets] = await storage.getBuckets();
      return buckets.map(b => ({
        name: b.name,
        createdAt: b.metadata.timeCreated ? new Date(b.metadata.timeCreated) : undefined,
      }));
    }

    throw new Error(`Unknown storage type: ${config.type}`);
  },

  /**
   * List files and folders at a given path
   */
  async listPath(configId: string, bucket: string, path: string = ''): Promise<FileInfo[]> {
    const config = await storageConfigService.getDecryptedConfig(configId);
    if (!config) {
      throw new Error('Storage configuration not found');
    }

    const prefix = path ? (path.endsWith('/') ? path : `${path}/`) : '';

    if (config.type === 's3') {
      const { S3Client, ListObjectsV2Command } = await import('@aws-sdk/client-s3');
      
      const credentials = config.s3AccessKeyId && config.s3SecretKey
        ? { accessKeyId: config.s3AccessKeyId, secretAccessKey: config.s3SecretKey }
        : undefined;

      const client = new S3Client({
        region: config.s3Region || 'us-east-1',
        credentials,
        endpoint: config.s3Endpoint || undefined,
        forcePathStyle: !!config.s3Endpoint,
      });

      const response = await client.send(new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        Delimiter: '/',
      }));

      const items: FileInfo[] = [];

      // Add folders (CommonPrefixes)
      for (const prefixObj of response.CommonPrefixes || []) {
        if (prefixObj.Prefix) {
          const folderName = prefixObj.Prefix.replace(prefix, '').replace(/\/$/, '');
          if (folderName) {
            items.push({
              name: folderName,
              path: prefixObj.Prefix,
              type: 'folder',
            });
          }
        }
      }

      // Add files
      for (const obj of response.Contents || []) {
        if (obj.Key && obj.Key !== prefix) {
          const fileName = obj.Key.replace(prefix, '');
          if (fileName && !fileName.includes('/')) {
            items.push({
              name: fileName,
              path: obj.Key,
              type: 'file',
              size: obj.Size,
              lastModified: obj.LastModified,
            });
          }
        }
      }

      return items;
    }

    if (config.type === 'azure') {
      const { BlobServiceClient, StorageSharedKeyCredential } = await import('@azure/storage-blob');
      
      let serviceClient: InstanceType<typeof BlobServiceClient>;

      if (config.azureConnectionStr) {
        serviceClient = BlobServiceClient.fromConnectionString(config.azureConnectionStr);
      } else if (config.azureAccount && config.azureAccessKey) {
        const credential = new StorageSharedKeyCredential(config.azureAccount, config.azureAccessKey);
        serviceClient = new BlobServiceClient(
          `https://${config.azureAccount}.blob.core.windows.net`,
          credential
        );
      } else {
        throw new Error('Azure credentials not configured');
      }

      const containerClient = serviceClient.getContainerClient(bucket);
      const items: FileInfo[] = [];
      const seenFolders = new Set<string>();

      for await (const blob of containerClient.listBlobsFlat({ prefix })) {
        const relativePath = blob.name.replace(prefix, '');
        const parts = relativePath.split('/');

        if (parts.length > 1) {
          // This is inside a subfolder
          const folderName = parts[0];
          if (!seenFolders.has(folderName)) {
            seenFolders.add(folderName);
            items.push({
              name: folderName,
              path: prefix + folderName + '/',
              type: 'folder',
            });
          }
        } else if (relativePath) {
          // This is a file at current level
          items.push({
            name: relativePath,
            path: blob.name,
            type: 'file',
            size: blob.properties.contentLength,
            lastModified: blob.properties.lastModified,
          });
        }
      }

      return items;
    }

    if (config.type === 'gcs') {
      const { Storage } = await import('@google-cloud/storage');
      
      let storage: InstanceType<typeof Storage>;

      if (config.gcsKeyFile) {
        const credentials = JSON.parse(config.gcsKeyFile);
        storage = new Storage({
          projectId: config.gcsProjectId || credentials.project_id,
          credentials,
        });
      } else {
        storage = new Storage({
          projectId: config.gcsProjectId,
        });
      }

      const [files] = await storage.bucket(bucket).getFiles({
        prefix,
        delimiter: '/',
        autoPaginate: false,
      });

      const items: FileInfo[] = [];

      // GCS returns prefixes in the apiResponse
      const bucketObj = storage.bucket(bucket);
      const [, , apiResponse] = await bucketObj.getFiles({
        prefix,
        delimiter: '/',
        autoPaginate: false,
      });

      // Add folders
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const prefixes = (apiResponse as Record<string, any>)?.prefixes || [];
      for (const p of prefixes) {
        const folderName = p.replace(prefix, '').replace(/\/$/, '');
        if (folderName) {
          items.push({
            name: folderName,
            path: p,
            type: 'folder',
          });
        }
      }

      // Add files
      for (const file of files) {
        const fileName = file.name.replace(prefix, '');
        if (fileName && !fileName.includes('/')) {
items.push({
              name: fileName,
              path: file.name,
              type: 'file',
              size: parseInt(String(file.metadata.size || '0'), 10),
              lastModified: file.metadata.updated ? new Date(file.metadata.updated) : undefined,
            });
        }
      }

      return items;
    }

    throw new Error(`Unknown storage type: ${config.type}`);
  },

  /**
   * Detect Delta tables at a given path (recursive scan for _delta_log folders)
   */
  async detectDeltaTables(configId: string, bucket: string, path: string = '', maxDepth: number = 3): Promise<DeltaTableInfo[]> {
    const tables: DeltaTableInfo[] = [];
    
    const scanPath = async (currentPath: string, depth: number) => {
      if (depth > maxDepth) return;

      try {
        const items = await this.listPath(configId, bucket, currentPath);
        
        // Check if this is a Delta table (has _delta_log folder)
        const hasDeltaLog = items.some(item => item.type === 'folder' && item.name === '_delta_log');
        
        if (hasDeltaLog) {
          // This is a Delta table
          const tableName = currentPath.split('/').filter(Boolean).pop() || bucket;
          const location = this.buildLocation(configId, bucket, currentPath);
          
          // Try to get metadata
          let version = 0;
          let numFiles = 0;
          const sizeBytes = 0;

          try {
            const deltaLogItems = await this.listPath(configId, bucket, `${currentPath}/_delta_log`.replace(/^\//, ''));
            numFiles = deltaLogItems.filter(f => f.type === 'file').length;
            
            // Find the latest version
            const versionFiles = deltaLogItems
              .filter(f => f.name.endsWith('.json'))
              .map(f => parseInt(f.name.replace('.json', ''), 10))
              .filter(v => !isNaN(v));
            
            if (versionFiles.length > 0) {
              version = Math.max(...versionFiles);
            }
          } catch {
            // Ignore errors reading delta log
          }

          tables.push({
            name: tableName,
            location,
            version,
            numFiles,
            sizeBytes,
          });
        } else {
          // Recursively scan folders
          const folders = items.filter(item => item.type === 'folder' && item.name !== '_delta_log');
          for (const folder of folders) {
            await scanPath(folder.path, depth + 1);
          }
        }
      } catch (error) {
        logger.error(`Error scanning path ${currentPath}`, error as Error);
      }
    };

    await scanPath(path, 0);
    return tables;
  },

  /**
   * Preview Delta table data
   * 
   * Note: For storage browser, we're previewing tables that may not be registered
   * as shares yet. In hybrid mode, OSS server won't know about these tables,
   * so we always use the custom reader via ossProxyService in standalone mode.
   */
  async previewTable(configId: string, location: string, limit: number = 10) {
    // Get the decrypted config to verify it exists
    const config = await storageConfigService.getDecryptedConfig(configId);
    if (!config) {
      throw new Error('Storage configuration not found');
    }

    // For storage browser preview, we use ossProxyService in standalone mode
    // since the table isn't registered with OSS yet
    // In hybrid mode, fall back to custom reader directly
    if (ossProxyService.isHybridMode()) {
      // In hybrid mode, use custom reader directly for unregistered tables
      const { queryTable, getTableMetadata } = await import('../delta/reader.js');
      const metadata = await getTableMetadata(location);
      const result = await queryTable(location, { limit, offset: 0 });

      return {
        metadata: {
          id: metadata.id,
          name: metadata.name,
          description: metadata.description,
          columns: metadata.columns,
          version: metadata.version,
          createdTime: metadata.createdTime,
        },
        rows: result.rows,
        totalRows: result.totalRows,
      };
    }

    // In standalone mode, use ossProxyService which wraps the custom reader
    const metadata = await ossProxyService.getTableMetadata('', '', '', location);
    const result = await ossProxyService.queryTable('', '', '', {
      limit,
      offset: 0,
      tableLocation: location,
    });

    return {
      metadata,
      rows: result.rows,
      totalRows: result.totalRows,
    };
  },

  /**
   * Build a storage location URL from components
   * Returns the internal cloud:// format that preserves the configId for credential lookup
   * Format: cloud://configId/bucket/path
   */
  buildLocation(configId: string, bucket: string, path: string): string {
    // Remove leading/trailing slashes from path
    const cleanPath = path.replace(/^\/+|\/+$/g, '');
    
    // Return cloud:// format to preserve configId for credential lookup
    // The getStorageAdapterForCloudLocation function will resolve this to actual credentials
    return cleanPath 
      ? `cloud://${configId}/${bucket}/${cleanPath}`
      : `cloud://${configId}/${bucket}`;
  },

  /**
   * Parse a location URL into components
   */
  parseLocation(location: string): { configId?: string; bucket: string; path: string; type: string } {
    // Handle s3:// URLs
    if (location.startsWith('s3://')) {
      const withoutProtocol = location.replace('s3://', '');
      const [bucket, ...pathParts] = withoutProtocol.split('/');
      return { bucket, path: pathParts.join('/'), type: 's3' };
    }

    // Handle azure:// URLs (wasbs://)
    if (location.startsWith('wasbs://') || location.startsWith('abfss://')) {
      const withoutProtocol = location.replace(/^(wasbs|abfss):\/\//, '');
      const [containerAndAccount, ...pathParts] = withoutProtocol.split('/');
      const [container] = containerAndAccount.split('@');
      return { bucket: container, path: pathParts.join('/'), type: 'azure' };
    }

    // Handle gs:// URLs
    if (location.startsWith('gs://')) {
      const withoutProtocol = location.replace('gs://', '');
      const [bucket, ...pathParts] = withoutProtocol.split('/');
      return { bucket, path: pathParts.join('/'), type: 'gcs' };
    }

    // Handle cloud:// format (our internal format with configId)
    if (location.startsWith('cloud://')) {
      const withoutProtocol = location.replace('cloud://', '');
      const [configId, bucket, ...pathParts] = withoutProtocol.split('/');
      return { configId, bucket, path: pathParts.join('/'), type: 'cloud' };
    }

    // Default to local file path
    return { bucket: '', path: location, type: 'local' };
  },
};

