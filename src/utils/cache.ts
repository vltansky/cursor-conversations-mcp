/**
 * Cache utility for improving performance of frequently accessed data
 */

/**
 * Configuration options for cache instances
 */
export interface CacheConfig {
  /** Maximum number of entries to store in cache */
  maxSize?: number;
  /** Default time-to-live in milliseconds */
  defaultTTL?: number;
  /** Eviction policy when cache is full */
  evictionPolicy?: 'lru' | 'fifo';
  /** Whether to enable automatic cleanup of expired entries */
  enableCleanup?: boolean;
  /** Interval for automatic cleanup in milliseconds */
  cleanupInterval?: number;
}

/**
 * Cache entry with metadata
 */
export interface CacheEntry<T = any> {
  /** The cached value */
  value: T;
  /** Timestamp when the entry was created */
  createdAt: number;
  /** Timestamp when the entry was last accessed */
  lastAccessedAt: number;
  /** Time-to-live in milliseconds */
  ttl?: number;
  /** Timestamp when the entry expires */
  expiresAt?: number;
}

/**
 * Cache statistics for monitoring
 */
export interface CacheStats {
  /** Total number of cache hits */
  hits: number;
  /** Total number of cache misses */
  misses: number;
  /** Current number of entries in cache */
  size: number;
  /** Maximum size configured for cache */
  maxSize: number;
  /** Cache hit rate as a percentage */
  hitRate: number;
  /** Number of entries evicted due to size limits */
  evictions: number;
  /** Number of entries expired due to TTL */
  expirations: number;
}

/**
 * Basic cache implementation with TTL, size limits, and eviction policies
 */
export class Cache<T = any> {
  private entries: Map<string, CacheEntry<T>> = new Map();
  private accessOrder: string[] = []; // For LRU tracking
  private insertOrder: string[] = []; // For FIFO tracking
  private config: Required<CacheConfig>;
  private stats: CacheStats;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(config: CacheConfig = {}) {
    this.config = {
      maxSize: config.maxSize ?? 1000,
      defaultTTL: config.defaultTTL ?? 5 * 60 * 1000, // 5 minutes
      evictionPolicy: config.evictionPolicy ?? 'lru',
      enableCleanup: config.enableCleanup ?? true,
      cleanupInterval: config.cleanupInterval ?? 60 * 1000, // 1 minute
    };

    this.stats = {
      hits: 0,
      misses: 0,
      size: 0,
      maxSize: this.config.maxSize,
      hitRate: 0,
      evictions: 0,
      expirations: 0,
    };

    if (this.config.enableCleanup) {
      this.startCleanupTimer();
    }
  }

  /**
   * Get a value from the cache
   */
  get(key: string): T | undefined {
    const entry = this.entries.get(key);

    if (!entry) {
      this.stats.misses++;
      this.updateHitRate();
      return undefined;
    }

    if (this.isExpired(entry)) {
      this.delete(key);
      this.stats.expirations++;
      this.stats.misses++;
      this.updateHitRate();
      return undefined;
    }

    this.updateAccessOrder(key);
    this.stats.hits++;
    this.updateHitRate();
    return entry.value;
  }

  /**
   * Set a value in the cache
   */
  set(key: string, value: T, customTtl?: number): void {
    const now = Date.now();
    const ttl = customTtl ?? this.config.defaultTTL;
    const expiresAt = now + ttl;

    const entry: CacheEntry<T> = {
      value,
      createdAt: now,
      lastAccessedAt: now,
      ttl,
      expiresAt
    };

    if (this.entries.has(key)) {
      this.removeFromTrackingArrays(key);
    }

    if (this.entries.size >= this.config.maxSize && !this.entries.has(key)) {
      this.evictEntry();
    }

    this.entries.set(key, entry);
    this.accessOrder.push(key);
    this.insertOrder.push(key);
    this.updateSize();
  }

  /**
   * Delete a value from the cache
   */
  delete(key: string): boolean {
    const existed = this.entries.delete(key);
    if (existed) {
      this.removeFromTrackingArrays(key);
      this.updateSize();
    }
    return existed;
  }

  /**
   * Check if a key exists in the cache (without affecting access order)
   */
  has(key: string): boolean {
    const entry = this.entries.get(key);
    if (!entry) {
      return false;
    }

    if (this.isExpired(entry)) {
      this.delete(key);
      this.stats.expirations++;
      return false;
    }

    return true;
  }

  /**
   * Clear all entries from the cache
   */
  clear(): void {
    this.entries.clear();
    this.accessOrder = [];
    this.insertOrder = [];
    this.updateSize();
  }

  /**
   * Get current cache size
   */
  size(): number {
    return this.entries.size;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      size: this.entries.size,
      maxSize: this.config.maxSize,
      hitRate: 0,
      evictions: 0,
      expirations: 0,
    };
  }

  /**
   * Manually trigger cleanup of expired entries
   */
  cleanup(): number {
    const initialSize = this.entries.size;
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.entries) {
      if (this.isExpired(entry)) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.delete(key);
      this.stats.expirations++;
    }

    return initialSize - this.entries.size;
  }

  /**
   * Get all keys in the cache
   */
  keys(): string[] {
    return Array.from(this.entries.keys());
  }

  /**
   * Get all values in the cache
   */
  values(): T[] {
    return Array.from(this.entries.values()).map(entry => entry.value);
  }

  /**
   * Destroy the cache and cleanup resources
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    this.clear();
  }

  /**
   * Check if an entry has expired
   */
  private isExpired(entry: CacheEntry<T>): boolean {
    if (!entry.expiresAt) {
      return false;
    }
    return Date.now() > entry.expiresAt;
  }

  /**
   * Update access order for LRU tracking
   */
  private updateAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(key);
  }

  /**
   * Remove key from tracking arrays
   */
  private removeFromTrackingArrays(key: string): void {
    const accessIndex = this.accessOrder.indexOf(key);
    if (accessIndex > -1) {
      this.accessOrder.splice(accessIndex, 1);
    }

    const insertIndex = this.insertOrder.indexOf(key);
    if (insertIndex > -1) {
      this.insertOrder.splice(insertIndex, 1);
    }
  }

  /**
   * Evict an entry based on the configured eviction policy
   */
  private evictEntry(): void {
    let keyToEvict: string | undefined;

    if (this.config.evictionPolicy === 'lru') {
      keyToEvict = this.accessOrder[0];
    } else if (this.config.evictionPolicy === 'fifo') {
      keyToEvict = this.insertOrder[0];
    }

    if (keyToEvict) {
      this.delete(keyToEvict);
      this.stats.evictions++;
    }
  }

  /**
   * Update cache size in stats
   */
  private updateSize(): void {
    this.stats.size = this.entries.size;
  }

  /**
   * Update hit rate calculation
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
  }

  /**
   * Start automatic cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }
}

/**
 * Create a new cache instance with the specified configuration
 */
export function createCache<T = any>(config?: CacheConfig): Cache<T> {
  return new Cache<T>(config);
}

/**
 * Default cache configurations for common use cases
 */
export const CachePresets = {
  /** Small, fast cache for frequently accessed data */
  small: {
    maxSize: 100,
    defaultTTL: 2 * 60 * 1000, // 2 minutes
    evictionPolicy: 'lru' as const,
    enableCleanup: true,
    cleanupInterval: 30 * 1000, // 30 seconds
  },

  /** Medium cache for general purpose use */
  medium: {
    maxSize: 500,
    defaultTTL: 5 * 60 * 1000, // 5 minutes
    evictionPolicy: 'lru' as const,
    enableCleanup: true,
    cleanupInterval: 60 * 1000, // 1 minute
  },

  /** Large cache for bulk data */
  large: {
    maxSize: 2000,
    defaultTTL: 15 * 60 * 1000, // 15 minutes
    evictionPolicy: 'lru' as const,
    enableCleanup: true,
    cleanupInterval: 2 * 60 * 1000, // 2 minutes
  },

  /** Long-lived cache for stable data */
  persistent: {
    maxSize: 1000,
    defaultTTL: 60 * 60 * 1000, // 1 hour
    evictionPolicy: 'fifo' as const,
    enableCleanup: true,
    cleanupInterval: 5 * 60 * 1000, // 5 minutes
  },
} as const;