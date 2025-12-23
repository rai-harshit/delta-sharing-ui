/**
 * Local Filesystem Storage Adapter
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import type { StorageAdapter } from './types.js';

// Simple token-based URL signing for local files
const LOCAL_FILE_SECRET = process.env.LOCAL_FILE_SECRET || 'local-file-secret-key';
const LOCAL_FILE_TOKENS = new Map<string, { path: string; expires: number }>();

export class LocalStorageAdapter implements StorageAdapter {
  private basePath: string;

  constructor(basePath: string = process.cwd()) {
    this.basePath = basePath;
  }

  private resolvePath(filePath: string): string {
    // If absolute path, use as-is
    if (path.isAbsolute(filePath)) {
      return filePath;
    }
    // Otherwise, resolve relative to base path
    return path.resolve(this.basePath, filePath);
  }

  async listFiles(dirPath: string): Promise<string[]> {
    const resolvedPath = this.resolvePath(dirPath);
    try {
      const entries = await fs.readdir(resolvedPath, { withFileTypes: true });
      return entries
        .filter(entry => entry.isFile())
        .map(entry => entry.name);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  async exists(filePath: string): Promise<boolean> {
    const resolvedPath = this.resolvePath(filePath);
    try {
      await fs.access(resolvedPath);
      return true;
    } catch {
      return false;
    }
  }

  async readFile(filePath: string): Promise<Buffer> {
    const resolvedPath = this.resolvePath(filePath);
    return fs.readFile(resolvedPath);
  }

  async readText(filePath: string): Promise<string> {
    const resolvedPath = this.resolvePath(filePath);
    return fs.readFile(resolvedPath, 'utf-8');
  }

  async readJson<T = unknown>(filePath: string): Promise<T> {
    const text = await this.readText(filePath);
    return JSON.parse(text) as T;
  }

  async getFileSize(filePath: string): Promise<number> {
    const resolvedPath = this.resolvePath(filePath);
    const stats = await fs.stat(resolvedPath);
    return stats.size;
  }

  /**
   * Generate a pre-signed URL for downloading a local file
   * Creates a signed token that can be validated by the download endpoint
   */
  async generatePresignedUrl(filePath: string, expiresInSeconds: number = 3600): Promise<string> {
    const resolvedPath = this.resolvePath(filePath);
    const expires = Date.now() + expiresInSeconds * 1000;
    
    // Create a unique token
    const tokenData = `${resolvedPath}:${expires}:${LOCAL_FILE_SECRET}`;
    const token = crypto.createHash('sha256').update(tokenData).digest('hex');
    
    // Store the token mapping
    LOCAL_FILE_TOKENS.set(token, { path: resolvedPath, expires });
    
    // Clean up expired tokens periodically
    for (const [t, data] of LOCAL_FILE_TOKENS.entries()) {
      if (data.expires < Date.now()) {
        LOCAL_FILE_TOKENS.delete(t);
      }
    }

    // Return URL to internal download endpoint
    const baseUrl = process.env.DELTA_SHARING_ENDPOINT || 'http://localhost:5000';
    return `${baseUrl}/api/delta/files/${token}`;
  }
}

/**
 * Validate and resolve a local file download token
 * Returns the file path if valid, null otherwise
 */
export function validateLocalFileToken(token: string): string | null {
  const data = LOCAL_FILE_TOKENS.get(token);
  
  if (!data) {
    return null;
  }
  
  if (data.expires < Date.now()) {
    LOCAL_FILE_TOKENS.delete(token);
    return null;
  }
  
  return data.path;
}

