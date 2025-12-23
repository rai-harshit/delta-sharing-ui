/**
 * AWS S3 Storage Adapter
 * Full implementation for reading Delta tables from S3
 */

import { 
  S3Client, 
  ListObjectsV2Command, 
  GetObjectCommand, 
  HeadObjectCommand,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { StorageAdapter } from './types.js';
import { logger } from '../utils/logger.js';

export interface S3Config {
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  endpoint?: string;
  forcePathStyle?: boolean;
}

export class S3StorageAdapter implements StorageAdapter {
  private client: S3Client;
  private bucket: string;

  constructor(bucket: string, config: S3Config = {}) {
    this.bucket = bucket;
    
    // Build credentials if provided
    const credentials = config.accessKeyId && config.secretAccessKey
      ? {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        }
      : undefined;

    this.client = new S3Client({
      region: config.region || process.env.AWS_REGION || 'us-east-1',
      credentials,
      endpoint: config.endpoint || process.env.AWS_S3_ENDPOINT,
      forcePathStyle: config.forcePathStyle ?? !!config.endpoint, // Use path style for custom endpoints (MinIO, LocalStack)
    });
  }

  /**
   * List files in a directory (prefix)
   */
  async listFiles(dirPath: string): Promise<string[]> {
    const prefix = dirPath.endsWith('/') ? dirPath : `${dirPath}/`;
    
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
        Delimiter: '/',
      });

      const files: string[] = [];
      let continuationToken: string | undefined;

      // Handle pagination
      do {
        const response = await this.client.send(
          new ListObjectsV2Command({
            ...command.input,
            ContinuationToken: continuationToken,
          })
        );

        const contents = response.Contents || [];
        files.push(
          ...contents
            .map(obj => obj.Key?.replace(prefix, '') || '')
            .filter(name => name && !name.includes('/'))
        );

        continuationToken = response.NextContinuationToken;
      } while (continuationToken);

      return files;
    } catch (error) {
      if (error instanceof S3ServiceException) {
        logger.error(`S3 error listing files in ${dirPath}`, error);
      }
      throw error;
    }
  }

  /**
   * Check if a file or directory exists
   */
  async exists(filePath: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({
        Bucket: this.bucket,
        Key: filePath,
      }));
      return true;
    } catch (error) {
      if (error instanceof S3ServiceException && error.name === 'NotFound') {
        return false;
      }
      // For other errors, check if it's a directory by listing
      try {
        const files = await this.listFiles(filePath);
        return files.length > 0;
      } catch {
        return false;
      }
    }
  }

  /**
   * Read file contents as Buffer
   */
  async readFile(filePath: string): Promise<Buffer> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: filePath,
      });

      const response = await this.client.send(command);
      const stream = response.Body;
      
      if (!stream) {
        throw new Error(`Empty response body for file: ${filePath}`);
      }

      // Convert stream to buffer
      const chunks: Uint8Array[] = [];
      for await (const chunk of stream as AsyncIterable<Uint8Array>) {
        chunks.push(chunk);
      }
      return Buffer.concat(chunks);
    } catch (error) {
      if (error instanceof S3ServiceException) {
        throw new Error(`Failed to read S3 file s3://${this.bucket}/${filePath}: ${error.message}`);
      }
      throw error;
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
      throw new Error(`Failed to parse JSON from s3://${this.bucket}/${filePath}: ${error}`);
    }
  }

  /**
   * Get file size in bytes
   */
  async getFileSize(filePath: string): Promise<number> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: filePath,
      });

      const response = await this.client.send(command);
      return response.ContentLength || 0;
    } catch (error) {
      if (error instanceof S3ServiceException) {
        throw new Error(`Failed to get file size for s3://${this.bucket}/${filePath}: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get the bucket name
   */
  getBucket(): string {
    return this.bucket;
  }

  /**
   * Generate a pre-signed URL for downloading a file
   */
  async generatePresignedUrl(filePath: string, expiresInSeconds: number = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: filePath,
      });

      const url = await getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
      return url;
    } catch (error) {
      if (error instanceof S3ServiceException) {
        throw new Error(`Failed to generate pre-signed URL for s3://${this.bucket}/${filePath}: ${error.message}`);
      }
      throw error;
    }
  }
}
