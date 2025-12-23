/**
 * Storage Configuration Service
 * Handles CRUD operations for cloud storage configurations with encryption
 */

import { prisma } from '../db/client.js';
import crypto from 'crypto';
import { getEncryptionKey } from '../utils/encryption.js';

// Encryption configuration
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
// AUTH_TAG_LENGTH = 16 - reserved for future use with authenticated encryption

/**
 * Encrypt a string value
 */
function encrypt(text: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Return iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt a string value
 */
function decrypt(encryptedData: string): string {
  const key = getEncryptionKey();
  const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
  
  if (!ivHex || !authTagHex || !encrypted) {
    throw new Error('Invalid encrypted data format');
  }
  
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Mask a sensitive string for display (e.g., "AKIA****XYZ")
 */
function maskString(str: string | null): string | null {
  if (!str || str.length < 8) return str ? '****' : null;
  return `${str.substring(0, 4)}****${str.substring(str.length - 4)}`;
}

export interface CreateStorageConfigInput {
  name: string;
  type: 's3' | 'azure' | 'gcs';
  isDefault?: boolean;
  // S3
  s3Region?: string;
  s3AccessKeyId?: string;
  s3SecretKey?: string;
  s3Endpoint?: string;
  // Azure
  azureAccount?: string;
  azureAccessKey?: string;
  azureConnectionStr?: string;
  // GCS
  gcsProjectId?: string;
  gcsKeyFile?: string;
}

export interface StorageConfigResponse {
  id: string;
  name: string;
  type: string;
  isDefault: boolean;
  // S3 (masked)
  s3Region?: string | null;
  s3AccessKeyId?: string | null;
  s3Endpoint?: string | null;
  // Azure (masked)
  azureAccount?: string | null;
  // GCS (masked)
  gcsProjectId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string | null;
}

export const storageConfigService = {
  /**
   * Create a new storage configuration
   */
  async createConfig(data: CreateStorageConfigInput, createdBy?: string) {
    // If setting as default, unset any existing default of same type
    if (data.isDefault) {
      await prisma.storageConfig.updateMany({
        where: { type: data.type, isDefault: true },
        data: { isDefault: false },
      });
    }

    // Encrypt sensitive fields
    const encryptedData: Record<string, string | boolean | null | undefined> = {
      name: data.name,
      type: data.type,
      isDefault: data.isDefault ?? false,
      createdBy,
    };

    // S3 fields
    if (data.type === 's3') {
      encryptedData.s3Region = data.s3Region;
      encryptedData.s3AccessKeyId = data.s3AccessKeyId ? encrypt(data.s3AccessKeyId) : null;
      encryptedData.s3SecretKey = data.s3SecretKey ? encrypt(data.s3SecretKey) : null;
      encryptedData.s3Endpoint = data.s3Endpoint;
    }

    // Azure fields
    if (data.type === 'azure') {
      encryptedData.azureAccount = data.azureAccount;
      encryptedData.azureAccessKey = data.azureAccessKey ? encrypt(data.azureAccessKey) : null;
      encryptedData.azureConnectionStr = data.azureConnectionStr ? encrypt(data.azureConnectionStr) : null;
    }

    // GCS fields
    if (data.type === 'gcs') {
      encryptedData.gcsProjectId = data.gcsProjectId;
      encryptedData.gcsKeyFile = data.gcsKeyFile ? encrypt(data.gcsKeyFile) : null;
    }

    const config = await prisma.storageConfig.create({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: encryptedData as any,
    });

    return this.maskConfig(config);
  },

  /**
   * List all storage configurations (with masked credentials)
   */
  async listConfigs(): Promise<StorageConfigResponse[]> {
    const configs = await prisma.storageConfig.findMany({
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    return configs.map(config => this.maskConfig(config));
  },

  /**
   * Get a single configuration (masked)
   */
  async getConfig(id: string): Promise<StorageConfigResponse | null> {
    const config = await prisma.storageConfig.findUnique({
      where: { id },
    });

    return config ? this.maskConfig(config) : null;
  },

  /**
   * Get a configuration by name (masked)
   */
  async getConfigByName(name: string): Promise<StorageConfigResponse | null> {
    const config = await prisma.storageConfig.findUnique({
      where: { name },
    });

    return config ? this.maskConfig(config) : null;
  },

  /**
   * Update a storage configuration
   */
  async updateConfig(id: string, data: Partial<CreateStorageConfigInput>) {
    const existing = await prisma.storageConfig.findUnique({ where: { id } });
    if (!existing) {
      throw new Error('Storage configuration not found');
    }

    // If setting as default, unset any existing default of same type
    if (data.isDefault) {
      await prisma.storageConfig.updateMany({
        where: { type: existing.type, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const updateData: Record<string, string | boolean | null | undefined> = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.isDefault !== undefined) updateData.isDefault = data.isDefault;

    // S3 fields
    if (existing.type === 's3') {
      if (data.s3Region !== undefined) updateData.s3Region = data.s3Region;
      if (data.s3AccessKeyId !== undefined) {
        updateData.s3AccessKeyId = data.s3AccessKeyId ? encrypt(data.s3AccessKeyId) : null;
      }
      if (data.s3SecretKey !== undefined) {
        updateData.s3SecretKey = data.s3SecretKey ? encrypt(data.s3SecretKey) : null;
      }
      if (data.s3Endpoint !== undefined) updateData.s3Endpoint = data.s3Endpoint;
    }

    // Azure fields
    if (existing.type === 'azure') {
      if (data.azureAccount !== undefined) updateData.azureAccount = data.azureAccount;
      if (data.azureAccessKey !== undefined) {
        updateData.azureAccessKey = data.azureAccessKey ? encrypt(data.azureAccessKey) : null;
      }
      if (data.azureConnectionStr !== undefined) {
        updateData.azureConnectionStr = data.azureConnectionStr ? encrypt(data.azureConnectionStr) : null;
      }
    }

    // GCS fields
    if (existing.type === 'gcs') {
      if (data.gcsProjectId !== undefined) updateData.gcsProjectId = data.gcsProjectId;
      if (data.gcsKeyFile !== undefined) {
        updateData.gcsKeyFile = data.gcsKeyFile ? encrypt(data.gcsKeyFile) : null;
      }
    }

    const config = await prisma.storageConfig.update({
      where: { id },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: updateData as any,
    });

    return this.maskConfig(config);
  },

  /**
   * Delete a storage configuration
   */
  async deleteConfig(id: string) {
    await prisma.storageConfig.delete({ where: { id } });
  },

  /**
   * Get decrypted configuration (internal use only)
   */
  async getDecryptedConfig(id: string) {
    const config = await prisma.storageConfig.findUnique({
      where: { id },
    });

    if (!config) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const decrypted: Record<string, any> = {
      id: config.id,
      name: config.name,
      type: config.type,
      isDefault: config.isDefault,
    };

    if (config.type === 's3') {
      decrypted.s3Region = config.s3Region;
      decrypted.s3AccessKeyId = config.s3AccessKeyId ? decrypt(config.s3AccessKeyId) : null;
      decrypted.s3SecretKey = config.s3SecretKey ? decrypt(config.s3SecretKey) : null;
      decrypted.s3Endpoint = config.s3Endpoint;
    }

    if (config.type === 'azure') {
      decrypted.azureAccount = config.azureAccount;
      decrypted.azureAccessKey = config.azureAccessKey ? decrypt(config.azureAccessKey) : null;
      decrypted.azureConnectionStr = config.azureConnectionStr ? decrypt(config.azureConnectionStr) : null;
    }

    if (config.type === 'gcs') {
      decrypted.gcsProjectId = config.gcsProjectId;
      decrypted.gcsKeyFile = config.gcsKeyFile ? decrypt(config.gcsKeyFile) : null;
    }

    return decrypted;
  },

  /**
   * Test a storage configuration connection
   */
  async testConnection(id: string): Promise<{ success: boolean; message: string; buckets?: string[] }> {
    const config = await this.getDecryptedConfig(id);
    if (!config) {
      return { success: false, message: 'Configuration not found' };
    }

    try {
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
        const buckets = response.Buckets?.map(b => b.Name || '').filter(Boolean) || [];

        return { success: true, message: `Connected successfully. Found ${buckets.length} buckets.`, buckets };
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
          return { success: false, message: 'Azure credentials not configured' };
        }

        const buckets: string[] = [];
        for await (const container of serviceClient.listContainers()) {
          buckets.push(container.name);
        }

        return { success: true, message: `Connected successfully. Found ${buckets.length} containers.`, buckets };
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
        const bucketNames = buckets.map(b => b.name);

        return { success: true, message: `Connected successfully. Found ${bucketNames.length} buckets.`, buckets: bucketNames };
      }

      return { success: false, message: `Unknown storage type: ${config.type}` };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, message: `Connection failed: ${message}` };
    }
  },

  /**
   * Get default configuration for a storage type
   */
  async getDefaultConfig(type: string): Promise<StorageConfigResponse | null> {
    const config = await prisma.storageConfig.findFirst({
      where: { type, isDefault: true },
    });

    return config ? this.maskConfig(config) : null;
  },

  /**
   * Mask sensitive fields for external responses
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  maskConfig(config: Record<string, any>): StorageConfigResponse {
    return {
      id: config.id,
      name: config.name,
      type: config.type,
      isDefault: config.isDefault,
      s3Region: config.s3Region,
      s3AccessKeyId: config.s3AccessKeyId ? maskString(decrypt(config.s3AccessKeyId)) : null,
      s3Endpoint: config.s3Endpoint,
      azureAccount: config.azureAccount,
      gcsProjectId: config.gcsProjectId,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
      createdBy: config.createdBy,
    };
  },
};













