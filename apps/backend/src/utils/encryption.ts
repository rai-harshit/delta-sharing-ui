/**
 * Shared Encryption Utilities
 * 
 * Provides consistent encryption key management across all services.
 */

import crypto from 'crypto';
import { logger } from './logger.js';

// Cached key to avoid repeated derivation
let cachedKey: Buffer | null = null;

/**
 * Get the encryption key from environment or use dev fallback.
 * Returns a 32-byte key suitable for AES-256.
 * 
 * @throws Error if ENCRYPTION_KEY is not set in production
 */
export function getEncryptionKey(): Buffer {
  // Return cached key if available
  if (cachedKey) {
    return cachedKey;
  }

  const key = process.env.ENCRYPTION_KEY;
  
  if (!key) {
    // Hard fail in production - encryption key is required
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ENCRYPTION_KEY environment variable is required in production');
    }
    // Development only - use deterministic key for local testing
    logger.warn('ENCRYPTION_KEY not set, using development key (NOT FOR PRODUCTION)');
    cachedKey = crypto.scryptSync('delta-sharing-dev-key', 'delta-salt', 32);
    return cachedKey;
  }
  
  // If key is 64-char hex string, convert to buffer directly
  if (key.length === 64 && /^[0-9a-fA-F]+$/.test(key)) {
    cachedKey = Buffer.from(key, 'hex');
    return cachedKey;
  }
  
  // Otherwise derive 32-byte key from string using scrypt
  cachedKey = crypto.scryptSync(key, 'delta-salt', 32);
  return cachedKey;
}

/**
 * Get the encryption key as a string for simple encryption use cases.
 * Used by ossProxyService for simpler string-based encryption.
 */
export function getEncryptionKeyString(): string {
  const key = process.env.ENCRYPTION_KEY;
  
  if (!key) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ENCRYPTION_KEY environment variable is required in production');
    }
    logger.warn('ENCRYPTION_KEY not set, using development key (NOT FOR PRODUCTION)');
    return 'delta-sharing-dev-key';
  }
  
  return key;
}

/**
 * Clear the cached key (useful for testing)
 */
export function clearKeyCache(): void {
  cachedKey = null;
}

