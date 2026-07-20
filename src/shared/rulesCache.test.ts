/**
 * Unit tests for the global single-slot rules cache (`chrome.storage.local`-backed).
 *
 * Drives every branch: hit / miss / lazy-expiry-evict / storage-error on each
 * accessor, and the group-filtering selectors. `chrome.storage.local` is the global
 * vi.fn() mock from `src/test/setup.ts`; time is pinned with fake timers so the TTL
 * math is deterministic. Behavior is pinned as-is; no production source changes.
 *
 * Fixtures use only fake placeholders (`0prFAKE…`, `00gFAKE…`) per CLAUDE.md.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RulesCache, type RulesCacheEntry } from './rulesCache';
import type { FormattedRule } from './types';

const storage = chrome.storage.local as unknown as {
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
};

const CACHE_KEY = 'global_rules_cache';
const NOW = 1_000_000;

/** Build a cached entry; `rules` and freshness are overridable. */
function entry(overrides: Partial<RulesCacheEntry> = {}): RulesCacheEntry {
  return {
    rules: [],
    rawRules: [],
    stats: { total: 0, active: 0, inactive: 0, conflicts: 0 },
    conflicts: [],
    timestamp: NOW,
    ttl: 5 * 60 * 1000,
    ...overrides,
  };
}

/** A minimal FormattedRule for the group-filter selectors. */
function rule(id: string, status: 'ACTIVE' | 'INACTIVE', groupIds: string[]): FormattedRule {
  return { id, status, groupIds } as unknown as FormattedRule;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  storage.get.mockResolvedValue({});
  storage.set.mockResolvedValue(undefined);
  storage.remove.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('RulesCache.get', () => {
  it('returns null when nothing is cached', async () => {
    storage.get.mockResolvedValue({});
    expect(await RulesCache.get()).toBeNull();
  });

  it('returns the entry when present and unexpired', async () => {
    const e = entry({ timestamp: NOW - 1000, rules: [rule('0prFAKE1', 'ACTIVE', ['00gA'])] });
    storage.get.mockResolvedValue({ [CACHE_KEY]: e });

    const result = await RulesCache.get();

    expect(storage.get).toHaveBeenCalledWith(CACHE_KEY);
    expect(result).toBe(e);
  });

  it('evicts and returns null when the entry has expired', async () => {
    const e = entry({ timestamp: NOW - 10_000, ttl: 1000 }); // expired 9s ago
    storage.get.mockResolvedValue({ [CACHE_KEY]: e });

    expect(await RulesCache.get()).toBeNull();
    expect(storage.remove).toHaveBeenCalledWith(CACHE_KEY); // lazy evict via clear()
  });

  it('returns null and swallows a storage error', async () => {
    storage.get.mockRejectedValue(new Error('storage down'));
    expect(await RulesCache.get()).toBeNull();
  });
});

describe('RulesCache.set', () => {
  it('writes an entry stamped with the current time and given ttl', async () => {
    await RulesCache.set([], [], { total: 1, active: 1, inactive: 0, conflicts: 0 }, [], 1234);

    expect(storage.set).toHaveBeenCalledWith({
      [CACHE_KEY]: expect.objectContaining({ timestamp: NOW, ttl: 1234 }),
    });
  });

  it('defaults the ttl to 5 minutes when omitted', async () => {
    await RulesCache.set([], [], { total: 0, active: 0, inactive: 0, conflicts: 0 }, []);
    expect(storage.set).toHaveBeenCalledWith({
      [CACHE_KEY]: expect.objectContaining({ ttl: 5 * 60 * 1000 }),
    });
  });

  it('swallows a storage error', async () => {
    storage.set.mockRejectedValue(new Error('quota'));
    await expect(
      RulesCache.set([], [], { total: 0, active: 0, inactive: 0, conflicts: 0 }, []),
    ).resolves.toBeUndefined();
  });
});

describe('RulesCache.clear', () => {
  it('removes the cache key', async () => {
    await RulesCache.clear();
    expect(storage.remove).toHaveBeenCalledWith(CACHE_KEY);
  });

  it('swallows a storage error', async () => {
    storage.remove.mockRejectedValue(new Error('boom'));
    await expect(RulesCache.clear()).resolves.toBeUndefined();
  });
});

describe('RulesCache.getRulesForGroup', () => {
  it('returns [] when the cache is empty', async () => {
    storage.get.mockResolvedValue({});
    expect(await RulesCache.getRulesForGroup('00gA')).toEqual([]);
  });

  it('returns only the rules whose groupIds include the group', async () => {
    storage.get.mockResolvedValue({
      [CACHE_KEY]: entry({
        rules: [
          rule('0prFAKE1', 'ACTIVE', ['00gA', '00gB']),
          rule('0prFAKE2', 'INACTIVE', ['00gC']),
        ],
      }),
    });

    const result = await RulesCache.getRulesForGroup('00gA');
    expect(result.map((r) => r.id)).toEqual(['0prFAKE1']);
  });
});

describe('RulesCache.getActiveRulesForGroup', () => {
  it('returns [] when the cache is empty', async () => {
    storage.get.mockResolvedValue({});
    expect(await RulesCache.getActiveRulesForGroup('00gA')).toEqual([]);
  });

  it('returns only ACTIVE rules that target the group', async () => {
    storage.get.mockResolvedValue({
      [CACHE_KEY]: entry({
        rules: [
          rule('0prFAKE1', 'ACTIVE', ['00gA']), // match
          rule('0prFAKE2', 'INACTIVE', ['00gA']), // wrong status
          rule('0prFAKE3', 'ACTIVE', ['00gB']), // wrong group
        ],
      }),
    });

    const result = await RulesCache.getActiveRulesForGroup('00gA');
    expect(result.map((r) => r.id)).toEqual(['0prFAKE1']);
  });
});

describe('RulesCache.isFresh', () => {
  it('is true when a valid entry exists', async () => {
    storage.get.mockResolvedValue({ [CACHE_KEY]: entry({ timestamp: NOW - 1000 }) });
    expect(await RulesCache.isFresh()).toBe(true);
  });

  it('is false when nothing is cached', async () => {
    storage.get.mockResolvedValue({});
    expect(await RulesCache.isFresh()).toBe(false);
  });
});

describe('RulesCache.getAge', () => {
  it('returns the age in ms when cached', async () => {
    storage.get.mockResolvedValue({ [CACHE_KEY]: entry({ timestamp: NOW - 4200 }) });
    expect(await RulesCache.getAge()).toBe(4200);
  });

  it('returns null when nothing is cached', async () => {
    storage.get.mockResolvedValue({});
    expect(await RulesCache.getAge()).toBeNull();
  });

  it('returns null and swallows a storage error', async () => {
    storage.get.mockRejectedValue(new Error('down'));
    expect(await RulesCache.getAge()).toBeNull();
  });
});
