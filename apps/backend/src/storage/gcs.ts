/**
 * Google Cloud Storage Adapter
 * Full implementation for reading Delta tables from GCS
 */

import { Storage, Bucket, GetFilesOptions } from '@google-cloud/storage';
import type { StorageAdapter } from './types.js';
import { logger } from '../utils/logger.js';

export interface GCSConfig {
  projectId?: string;
  keyFilename?: string;
  credentials?: {
    client_email: string;
    private_key: string;
  };
}

export class GCSStorageAdapter implements StorageAdapter {
  private bucket: Bucket;
  private bucketName: string;

  constructor(bucketName: string, config: GCSConfig = {}) {
    this.bucketName = bucketName;

    // Build storage client with available credentials
    const storageConfig: {
      projectId?: string;
      keyFilename?: string;
      credentials?: { client_email: string; private_key: string };
    } = {};

    if (config.projectId || process.env.GOOGLE_CLOUD_PROJECT) {
      storageConfig.projectId = config.projectId || process.env.GOOGLE_CLOUD_PROJECT;
    }

    if (config.keyFilename || process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      storageConfig.keyFilename = config.keyFilename || process.env.GOOGLE_APPLICATION_CREDENTIALS;
    }

    if (config.credentials) {
      storageConfig.credentials = config.credentials;
    }

    const storage = new Storage(storageConfig);
    this.bucket = storage.bucket(bucketName);
  }

  /**
   * List files in a directory (prefix)
   */
  async listFiles(dirPath: string): Promise<string[]> {
    const prefix = dirPath.endsWith('/') ? dirPath : `${dirPath}/`;
    
    try {
      const options: GetFilesOptions = {
        prefix,
        delimiter: '/',
        autoPaginate: true,
      };

      const [files] = await this.bucket.getFiles(options);

      return files
        .map(file => file.name.replace(prefix, ''))
        .filter(name => name && !name.includes('/'));
    } catch (error) {
      logger.error(`GCS error listing files in ${dirPath}`, error as Error);
      throw new Error(`Failed to list files in gs://${this.bucketName}/${dirPath}: ${error}`);
    }
  }

  /**
   * Check if a file or directory exists
   */
  async exists(filePath: string): Promise<boolean> {
    try {
      const file = this.bucket.file(filePath);
      const [exists] = await file.exists();
      
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
      const file = this.bucket.file(filePath);
      const [contents] = await file.download();
      return contents;
    } catch (error) {
      throw new Error(`Failed to read GCS file gs://${this.bucketName}/${filePath}: ${error}`);
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
      throw new Error(`Failed to parse JSON from gs://${this.bucketName}/${filePath}: ${error}`);
    }
  }

  /**
   * Get file size in bytes
   */
  async getFileSize(filePath: string): Promise<number> {
    try {
      const file = this.bucket.file(filePath);
      const [metadata] = await file.getMetadata();
      return Number(metadata.size) || 0;
    } catch (error) {
      throw new Error(`Failed to get file size for gs://${this.bucketName}/${filePath}: ${error}`);
    }
  }

  /**
   * Get the bucket name
   */
  getBucketName(): string {
    return this.bucketName;
  }

  /**
   * Generate a pre-signed URL for downloading a file
   */
  async generatePresignedUrl(filePath: string, expiresInSeconds: number = 3600): Promise<string> {
    try {
      const file = this.bucket.file(filePath);
      
      const [url] = await file.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + expiresInSeconds * 1000,
      });

      return url;
    } catch (error) {
      throw new Error(`Failed to generate pre-signed URL for gs://${this.bucketName}/${filePath}: ${error}`);
    }
  }
}
