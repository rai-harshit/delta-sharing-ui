/**
 * Redis Cache Client
 * 
 * Provides Redis connectivity for:
 * - Rate limiting (distributed)
 * - Session storage
 * - General caching
 * 
 * Falls back to in-memory storage if Redis is not configured.
 */

import { logger } from '../utils/logger.js';

// ============================================
// Types
// ============================================

interface CacheOptions {
  ttl?: number; // Time to live in seconds
}

interface CacheClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: CacheOptions): Promise<void>;
  del(key: string): Promise<void>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<void>;
  ttl(key: string): Promise<number>;
  ping(): Promise<boolean>;
}

// ============================================
// In-Memory Fallback Store
// ============================================

class InMemoryStore implements CacheClient {
  private store = new Map<string, { value: string; expiresAt: number | null }>();

  async get(key: string): Promise<string | null> {
    const item = this.store.get(key);
    if (!item) return null;
    
    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.store.delete(key);
      return null;
    }
    
    return item.value;
  }

  async set(key: string, value: string, options?: CacheOptions): Promise<void> {
    const expiresAt = options?.ttl ? Date.now() + options.ttl * 1000 : null;
    this.store.set(key, { value, expiresAt });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async incr(key: string): Promise<number> {
    const item = this.store.get(key);
    const current = item?.value || '0';
    const newValue = (parseInt(current, 10) + 1).toString();
    // Preserve existing expiration when incrementing
    this.store.set(key, { value: newValue, expiresAt: item?.expiresAt || null });
    return parseInt(newValue, 10);
  }

  async expire(key: string, seconds: number): Promise<void> {
    const item = this.store.get(key);
    if (item) {
      item.expiresAt = Date.now() + seconds * 1000;
    }
  }

  async ttl(key: string): Promise<number> {
    const item = this.store.get(key);
    if (!item || !item.expiresAt) return -1;
    return Math.max(0, Math.floor((item.expiresAt - Date.now()) / 1000));
  }

  async ping(): Promise<boolean> {
    return true;
  }
}

// ============================================
// Redis Client (uses ioredis)
// ============================================

class RedisClient implements CacheClient {
  private client: import('ioredis').default | null = null;
  private connected = false;

  async connect(): Promise<void> {
    const redisUrl = process.env.REDIS_URL;
    
    if (!redisUrl) {
      logger.info('Redis not configured, using in-memory store');
      return;
    }

    try {
      // Dynamic import to avoid requiring ioredis when not used
      const { default: Redis } = await import('ioredis');
      
      this.client = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy(times) {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        lazyConnect: true,
      });

      this.client.on('error', (err) => {
        logger.error('Redis connection error', err);
        this.connected = false;
      });

      this.client.on('connect', () => {
        logger.info('Redis connected');
        this.connected = true;
      });

      this.client.on('close', () => {
        logger.warn('Redis connection closed');
        this.connected = false;
      });

      await this.client.connect();
    } catch (error) {
      logger.error('Failed to connect to Redis', error);
      this.client = null;
    }
  }

  isConnected(): boolean {
    return this.connected && this.client !== null;
  }

  async get(key: string): Promise<string | null> {
    if (!this.client) return null;
    return this.client.get(key);
  }

  async set(key: string, value: string, options?: CacheOptions): Promise<void> {
    if (!this.client) return;
    if (options?.ttl) {
      await this.client.setex(key, options.ttl, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.client) return;
    await this.client.del(key);
  }

  async incr(key: string): Promise<number> {
    if (!this.client) return 0;
    return this.client.incr(key);
  }

  async expire(key: string, seconds: number): Promise<void> {
    if (!this.client) return;
    await this.client.expire(key, seconds);
  }

  async ttl(key: string): Promise<number> {
    if (!this.client) return -1;
    return this.client.ttl(key);
  }

  async ping(): Promise<boolean> {
    if (!this.client) return false;
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.connected = false;
    }
  }
}

// ============================================
// Cache Manager
// ============================================

class CacheManager {
  private redisClient: RedisClient;
  private memoryStore: InMemoryStore;
  private initialized = false;

  constructor() {
    this.redisClient = new RedisClient();
    this.memoryStore = new InMemoryStore();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    await this.redisClient.connect();
    this.initialized = true;
  }

  private getClient(): CacheClient {
    return this.redisClient.isConnected() ? this.redisClient : this.memoryStore;
  }

  /**
   * Check if Redis is connected
   */
  isRedisConnected(): boolean {
    return this.redisClient.isConnected();
  }

  /**
   * Get a value from cache
   */
  async get(key: string): Promise<string | null> {
    return this.getClient().get(key);
  }

  /**
   * Get a value from cache and parse as JSON
   */
  async getJSON<T>(key: string): Promise<T | null> {
    const value = await this.get(key);
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  /**
   * Set a value in cache
   */
  async set(key: string, value: string, options?: CacheOptions): Promise<void> {
    return this.getClient().set(key, value, options);
  }

  /**
   * Set a JSON value in cache
   */
  async setJSON<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    return this.set(key, JSON.stringify(value), options);
  }

  /**
   * Delete a value from cache
   */
  async del(key: string): Promise<void> {
    return this.getClient().del(key);
  }

  /**
   * Increment a counter (for rate limiting)
   */
  async incr(key: string): Promise<number> {
    return this.getClient().incr(key);
  }

  /**
   * Set expiration on a key
   */
  async expire(key: string, seconds: number): Promise<void> {
    return this.getClient().expire(key, seconds);
  }

  /**
   * Get TTL of a key
   */
  async ttl(key: string): Promise<number> {
    return this.getClient().ttl(key);
  }

  /**
   * Health check
   */
  async ping(): Promise<{ redis: boolean; memory: boolean }> {
    return {
      redis: await this.redisClient.ping(),
      memory: await this.memoryStore.ping(),
    };
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    await this.redisClient.disconnect();
  }
}

// ============================================
// Singleton Export
// ============================================

export const cache = new CacheManager();

// ============================================
// Rate Limiter using Cache
// ============================================

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

/**
 * Check rate limit for a key (increments counter)
 * @param key - Unique key (e.g., IP address or user ID)
 * @param limit - Maximum requests allowed
 * @param windowSeconds - Time window in seconds
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const cacheKey = `ratelimit:${key}`;
  
  const count = await cache.incr(cacheKey);
  
  // Set expiration on first request
  if (count === 1) {
    await cache.expire(cacheKey, windowSeconds);
  }
  
  const ttl = await cache.ttl(cacheKey);
  const resetAt = new Date(Date.now() + ttl * 1000);
  
  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    resetAt,
  };
}

/**
 * Get current rate limit count WITHOUT incrementing
 * Used for skip logic where we check first, then conditionally increment
 */
export async function getRateLimitStatus(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const cacheKey = `ratelimit:${key}`;
  
  const currentValue = await cache.get(cacheKey);
  const count = currentValue ? parseInt(currentValue, 10) : 0;
  
  const ttl = await cache.ttl(cacheKey);
  const resetAt = ttl > 0 
    ? new Date(Date.now() + ttl * 1000)
    : new Date(Date.now() + windowSeconds * 1000);
  
  return {
    allowed: count < limit,
    remaining: Math.max(0, limit - count),
    resetAt,
  };
}

