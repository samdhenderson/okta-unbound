/**
 * Global Rules Cache Service
 *
 * Provides centralized caching for Okta group rules to avoid redundant API calls.
 * Rules are cached with a configurable TTL and can be shared across all components.
 */

import type { FormattedRule, OktaGroupRule } from './types';

interface RulesCacheEntry {
  rules: FormattedRule[];
  rawRules: OktaGroupRule[];
  stats: {
    total: number;
    active: number;
    inactive: number;
    conflicts: number;
  };
  conflicts: any[];
  timestamp: number;
  ttl: number;
}

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
        console.log('[RulesCache] Cache expired');
        await this.clear();
        return null;
      }

      console.log('[RulesCache] Using cached rules:', {
        count: cached.rules.length,
        age: Math.round((now - cached.timestamp) / 1000) + 's',
        expiresIn: Math.round((cached.timestamp + cached.ttl - now) / 1000) + 's'
      });

      return cached;
    } catch (error) {
      console.error('[RulesCache] Failed to get cache:', error);
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
    conflicts: any[],
    ttl: number = this.DEFAULT_TTL
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
      console.log('[RulesCache] Cached', rules.length, 'rules for', ttl / 1000, 'seconds');
    } catch (error) {
      console.error('[RulesCache] Failed to set cache:', error);
    }
  }

  /**
   * Clear the rules cache
   */
  static async clear(): Promise<void> {
    try {
      await chrome.storage.local.remove(this.CACHE_KEY);
      console.log('[RulesCache] Cache cleared');
    } catch (error) {
      console.error('[RulesCache] Failed to clear cache:', error);
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

    return cached.rules.filter(rule => rule.groupIds.includes(groupId));
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
      rule => rule.status === 'ACTIVE' && rule.groupIds.includes(groupId)
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
      console.error('[RulesCache] Failed to get cache age:', error);
      return null;
    }
  }
}

export { RulesCache };
export type { RulesCacheEntry };
