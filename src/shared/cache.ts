// Simple caching utility for Okta data
// Uses chrome.storage.local with expiration times

import { createLogger } from './utils/logger';

const log = createLogger('Cache');

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

export interface CacheOptions {
  ttl?: number; // Time to live in milliseconds (default: 5 minutes)
}

const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Sets a cache entry with expiration
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
 * Gets a cache entry if it exists and hasn't expired
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
