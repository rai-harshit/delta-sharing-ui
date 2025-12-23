/**
 * Azure Blob Storage Adapter
 * Full implementation for reading Delta tables from Azure Blob Storage
 */

import { 
  BlobServiceClient, 
  ContainerClient,
  StorageSharedKeyCredential,
  AnonymousCredential,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
  SASProtocol,
} from '@azure/storage-blob';
import type { StorageAdapter } from './types.js';
import { logger } from '../utils/logger.js';

export interface AzureConfig {
  connectionString?: string;
  accountName?: string;
  accountKey?: string;
  sasToken?: string;
}

export class AzureStorageAdapter implements StorageAdapter {
  private containerClient: ContainerClient;
  private containerName: string;
  private accountName: string;
  private sharedKeyCredential: StorageSharedKeyCredential | null = null;

  constructor(container: string, account: string, config: AzureConfig = {}) {
    this.containerName = container;
    this.accountName = account;

    let blobServiceClient: BlobServiceClient;

    // Try connection string first
    if (config.connectionString) {
      blobServiceClient = BlobServiceClient.fromConnectionString(config.connectionString);
      // Extract account key from connection string for SAS generation
      const keyMatch = config.connectionString.match(/AccountKey=([^;]+)/);
      if (keyMatch) {
        this.sharedKeyCredential = new StorageSharedKeyCredential(account, keyMatch[1]);
      }
    } 
    // Then try environment variable
    else if (process.env.AZURE_STORAGE_CONNECTION_STRING) {
      blobServiceClient = BlobServiceClient.fromConnectionString(
        process.env.AZURE_STORAGE_CONNECTION_STRING
      );
      const keyMatch = process.env.AZURE_STORAGE_CONNECTION_STRING.match(/AccountKey=([^;]+)/);
      if (keyMatch) {
        this.sharedKeyCredential = new StorageSharedKeyCredential(account, keyMatch[1]);
      }
    }
    // Try account key authentication
    else if (config.accountKey || process.env.AZURE_STORAGE_KEY) {
      const key = config.accountKey || process.env.AZURE_STORAGE_KEY!;
      this.sharedKeyCredential = new StorageSharedKeyCredential(account, key);
      const url = `https://${account}.blob.core.windows.net`;
      blobServiceClient = new BlobServiceClient(url, this.sharedKeyCredential);
    }
    // Try SAS token
    else if (config.sasToken || process.env.AZURE_STORAGE_SAS_TOKEN) {
      const sasToken = config.sasToken || process.env.AZURE_STORAGE_SAS_TOKEN!;
      const url = `https://${account}.blob.core.windows.net?${sasToken}`;
      blobServiceClient = new BlobServiceClient(url);
    }
    // Default to anonymous access (for public containers)
    else {
      const url = `https://${account}.blob.core.windows.net`;
      blobServiceClient = new BlobServiceClient(url, new AnonymousCredential());
    }

    this.containerClient = blobServiceClient.getContainerClient(container);
  }

  /**
   * List files in a directory (prefix)
   */
  async listFiles(dirPath: string): Promise<string[]> {
    const prefix = dirPath.endsWith('/') ? dirPath : `${dirPath}/`;
    const files: string[] = [];

    try {
      for await (const blob of this.containerClient.listBlobsFlat({ prefix })) {
        const name = blob.name.replace(prefix, '');
        // Only include files directly in the directory (not subdirectories)
        if (name && !name.includes('/')) {
          files.push(name);
        }
      }
      return files;
    } catch (error) {
      logger.error(`Azure error listing files in ${dirPath}`, error as Error);
      throw new Error(`Failed to list files in azure://${this.containerName}/${dirPath}: ${error}`);
    }
  }

  /**
   * Check if a file or directory exists
   */
  async exists(filePath: string): Promise<boolean> {
    try {
      const blobClient = this.containerClient.getBlobClient(filePath);
      const exists = await blobClient.exists();
      
      if (exists) return true;

      // Check if it's a directory by listing contents
      const files = await this.listFiles(filePath);
      return files.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Read file contents as Buffer
   */
  async readFile(filePath: string): Promise<Buffer> {
    try {
      const blobClient = this.containerClient.getBlobClient(filePath);
      const downloadResponse = await blobClient.download();
      
      if (!downloadResponse.readableStreamBody) {
        throw new Error(`Empty response body for file: ${filePath}`);
      }

      const chunks: Buffer[] = [];
      for await (const chunk of downloadResponse.readableStreamBody) {
        chunks.push(Buffer.from(chunk));
      }
      return Buffer.concat(chunks);
    } catch (error) {
      throw new Error(`Failed to read Azure blob ${this.containerName}/${filePath}: ${error}`);
    }
  }

  /**
   * Read file contents as string
   */
  async readText(filePath: string): Promise<string> {
    const buffer = await this.readFile(filePath);
    return buffer.toString('utf-8');
  }

  /**
   * Read and parse JSON file
   */
  async readJson<T = unknown>(filePath: string): Promise<T> {
    const text = await this.readText(filePath);
    try {
      return JSON.parse(text) as T;
    } catch (error) {
      throw new Error(`Failed to parse JSON from azure://${this.containerName}/${filePath}: ${error}`);
    }
  }

  /**
   * Get file size in bytes
   */
  async getFileSize(filePath: string): Promise<number> {
    try {
      const blobClient = this.containerClient.getBlobClient(filePath);
      const properties = await blobClient.getProperties();
      return properties.contentLength || 0;
    } catch (error) {
      throw new Error(`Failed to get file size for azure://${this.containerName}/${filePath}: ${error}`);
    }
  }

  /**
   * Get container name
   */
  getContainerName(): string {
    return this.containerName;
  }

  /**
   * Get account name
   */
  getAccountName(): string {
    return this.accountName;
  }

  /**
   * Generate a pre-signed URL (SAS URL) for downloading a file
   */
  async generatePresignedUrl(filePath: string, expiresInSeconds: number = 3600): Promise<string> {
    if (!this.sharedKeyCredential) {
      throw new Error('Cannot generate pre-signed URL: no account key available. Configure account key or connection string.');
    }

    try {
      const blobClient = this.containerClient.getBlobClient(filePath);
      
      const startsOn = new Date();
      const expiresOn = new Date(startsOn.getTime() + expiresInSeconds * 1000);

      const sasToken = generateBlobSASQueryParameters(
        {
          containerName: this.containerName,
          blobName: filePath,
          permissions: BlobSASPermissions.parse('r'), // Read only
          startsOn,
          expiresOn,
          protocol: SASProtocol.Https,
        },
        this.sharedKeyCredential
      ).toString();

      return `${blobClient.url}?${sasToken}`;
    } catch (error) {
      throw new Error(`Failed to generate pre-signed URL for azure://${this.containerName}/${filePath}: ${error}`);
    }
  }
}
