/**
 * @module shared/cache
 * @description Generic TTL cache backed by `chrome.storage.local`.
 *
 * Stores arbitrary serialisable values keyed by string, each with an expiry
 * timestamp. Reads transparently evict and skip expired entries. Failures are
 * logged and swallowed so caching never breaks a caller's happy path.
 *
 * @see {@link setCacheEntry}
 * @see {@link getCacheEntry}
 */

import { createLogger } from './utils/logger';

const log = createLogger('Cache');

/** A stored cache record: the payload plus its write time and expiry. */
export interface CacheEntry<T> {
  /** The cached value. */
  data: T;
  /** Epoch millis when the entry was written. */
  timestamp: number;
  /** Epoch millis after which the entry is considered stale. */
  expiresAt: number;
}

/** Options controlling how a value is cached. */
export interface CacheOptions {
  /** Time to live in milliseconds (default: 5 minutes). */
  ttl?: number;
}

const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Write a value to the cache with an expiry derived from `options.ttl`.
 *
 * @param key - Storage key to write under.
 * @param data - Value to cache (must be structured-clone serialisable).
 * @param options - Optional TTL override; defaults to 5 minutes.
 * @remarks Never throws — storage errors are logged and swallowed.
 */
export async function setCacheEntry<T>(
  key: string,
  data: T,
  options: CacheOptions = {},
): Promise<void> {
  const ttl = options.ttl || DEFAULT_TTL;
  const now = Date.now();

  const entry: CacheEntry<T> = {
    data,
    timestamp: now,
    expiresAt: now + ttl,
  };

  try {
    await chrome.storage.local.set({ [key]: entry });
    log.debug(`Set entry for key: ${key}, expires in ${ttl}ms`);
  } catch (error) {
    log.error('Failed to set entry:', error);
  }
}

/**
 * Read a value from the cache, returning `null` if it is missing or expired.
 * Expired entries are removed as a side effect.
 *
 * @param key - Storage key to read.
 * @returns The cached value, or `null` on miss/expiry/error.
 */
export async function getCacheEntry<T>(key: string): Promise<T | null> {
  try {
    const result = await chrome.storage.local.get([key]);
    const entry = result[key] as CacheEntry<T> | undefined;

    if (!entry) {
      log.debug(`No entry found for key: ${key}`);
      return null;
    }

    const now = Date.now();

    if (now > entry.expiresAt) {
      log.debug(`Entry expired for key: ${key}`);
      // Clean up expired entry
      await chrome.storage.local.remove([key]);
      return null;
    }

    log.debug(`Cache hit for key: ${key}`);
    return entry.data;
  } catch (error) {
    log.error('Failed to get entry:', error);
    return null;
  }
}
