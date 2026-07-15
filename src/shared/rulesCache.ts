/**
 * @module shared/rulesCache
 * @description Global, single-slot cache for the org-wide group-rules payload.
 *
 * Backed by `chrome.storage.local` under one key, so every component shares the
 * same cached rules, stats, and conflicts instead of re-fetching. Entries carry a
 * configurable TTL and are lazily evicted on read. Provides convenience selectors
 * for the rules affecting a given group.
 *
 * @see {@link RulesCache}
 */

import { createLogger } from './utils/logger';
import type { FormattedRule, OktaGroupRule, RuleConflict } from './types';

const log = createLogger('RulesCache');

/** The single cached rules payload plus its freshness metadata. */
interface RulesCacheEntry {
  /** Rules shaped for display. */
  rules: FormattedRule[];
  /** Original rules exactly as returned by Okta. */
  rawRules: OktaGroupRule[];
  /** Aggregate counts across the cached rules. */
  stats: {
    total: number;
    active: number;
    inactive: number;
    conflicts: number;
  };
  /** Detected conflicts across the cached rules. */
  conflicts: RuleConflict[];
  /** Epoch millis when the entry was written. */
  timestamp: number;
  /** Lifetime in milliseconds before the entry is treated as stale. */
  ttl: number;
}

/**
 * Static facade over the single global rules cache entry. All methods read and
 * write the same `chrome.storage.local` slot; there is no per-instance state.
 */
class RulesCache {
  private static readonly CACHE_KEY = 'global_rules_cache';
  private static readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Get cached rules if available and not expired
   */
  static async get(): Promise<RulesCacheEntry | null> {
    try {
      const result = await chrome.storage.local.get(this.CACHE_KEY);
      const cached = result[this.CACHE_KEY] as RulesCacheEntry | undefined;

      if (!cached) {
        return null;
      }

      // Check if expired
      const now = Date.now();
      if (now > cached.timestamp + cached.ttl) {
        log.debug('Cache expired');
        await this.clear();
        return null;
      }

      log.debug('Using cached rules:', {
        count: cached.rules.length,
        age: Math.round((now - cached.timestamp) / 1000) + 's',
        expiresIn: Math.round((cached.timestamp + cached.ttl - now) / 1000) + 's',
      });

      return cached;
    } catch (error) {
      log.error('Failed to get cache:', error);
      return null;
    }
  }

  /**
   * Set rules cache with optional custom TTL
   */
  static async set(
    rules: FormattedRule[],
    rawRules: OktaGroupRule[],
    stats: RulesCacheEntry['stats'],
    conflicts: RuleConflict[],
    ttl: number = this.DEFAULT_TTL,
  ): Promise<void> {
    try {
      const entry: RulesCacheEntry = {
        rules,
        rawRules,
        stats,
        conflicts,
        timestamp: Date.now(),
        ttl,
      };

      await chrome.storage.local.set({ [this.CACHE_KEY]: entry });
      log.debug('Cached', rules.length, 'rules for', ttl / 1000, 'seconds');
    } catch (error) {
      log.error('Failed to set cache:', error);
    }
  }

  /**
   * Clear the rules cache
   */
  static async clear(): Promise<void> {
    try {
      await chrome.storage.local.remove(this.CACHE_KEY);
      log.debug('Cache cleared');
    } catch (error) {
      log.error('Failed to clear cache:', error);
    }
  }

  /**
   * Get rules for a specific group (filters from cache if available)
   */
  static async getRulesForGroup(groupId: string): Promise<FormattedRule[]> {
    const cached = await this.get();
    if (!cached) {
      return [];
    }

    return cached.rules.filter((rule) => rule.groupIds.includes(groupId));
  }

  /**
   * Get active rules that might assign users to a specific group
   */
  static async getActiveRulesForGroup(groupId: string): Promise<FormattedRule[]> {
    const cached = await this.get();
    if (!cached) {
      return [];
    }

    return cached.rules.filter(
      (rule) => rule.status === 'ACTIVE' && rule.groupIds.includes(groupId),
    );
  }

  /**
   * Check if cache is fresh (not expired)
   */
  static async isFresh(): Promise<boolean> {
    const cached = await this.get();
    return cached !== null;
  }

  /**
   * Get cache age in milliseconds
   */
  static async getAge(): Promise<number | null> {
    try {
      const result = await chrome.storage.local.get(this.CACHE_KEY);
      const cached = result[this.CACHE_KEY] as RulesCacheEntry | undefined;

      if (!cached) {
        return null;
      }

      return Date.now() - cached.timestamp;
    } catch (error) {
      log.error('Failed to get cache age:', error);
      return null;
    }
  }
}

export { RulesCache };
export type { RulesCacheEntry };
