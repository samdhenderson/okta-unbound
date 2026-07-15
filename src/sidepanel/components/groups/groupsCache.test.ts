import { describe, it, expect } from 'vitest';
import type { GroupSummary } from '../../../shared/types';
import {
  CACHE_DURATION,
  parseGroupsCache,
  serializeGroupsCache,
  reviveGroupDates,
} from './groupsCache';

const NOW = 1_700_000_000_000;

describe('reviveGroupDates', () => {
  it('revives lastUpdated and created into Date instances', () => {
    const revived = reviveGroupDates({
      id: 'g1',
      name: 'Eng',
      lastUpdated: '2026-01-02T00:00:00Z',
      created: '2025-01-01T00:00:00Z',
    });
    expect(revived.lastUpdated).toBeInstanceOf(Date);
    expect(revived.created).toBeInstanceOf(Date);
  });

  it('does NOT revive lastMembershipUpdated (stays a string) and preserves other fields', () => {
    const revived = reviveGroupDates({
      id: 'g1',
      name: 'Eng',
      memberCount: 9,
      lastMembershipUpdated: '2026-03-03T00:00:00Z',
    });
    expect(
      typeof (revived as unknown as { lastMembershipUpdated: unknown }).lastMembershipUpdated,
    ).toBe('string');
    expect(revived.memberCount).toBe(9);
    expect(revived.lastUpdated).toBeUndefined();
  });
});

describe('parseGroupsCache', () => {
  const groups: GroupSummary[] = [
    {
      id: 'g1',
      name: 'Eng',
      type: 'OKTA_GROUP',
      memberCount: 3,
      hasRules: false,
      ruleCount: 0,
      lastUpdated: new Date('2026-01-02T00:00:00Z'),
    },
  ];

  it('returns revived groups (with Date instances) for a fresh entry', () => {
    const raw = serializeGroupsCache(groups, NOW);
    const parsed = parseGroupsCache(raw, NOW + 1000);
    expect(parsed).not.toBeNull();
    expect(parsed![0].lastUpdated).toBeInstanceOf(Date);
    expect(parsed![0].id).toBe('g1');
  });

  it('returns null once the entry has aged past CACHE_DURATION (inclusive boundary)', () => {
    const raw = serializeGroupsCache(groups, NOW);
    expect(parseGroupsCache(raw, NOW + CACHE_DURATION - 1)).not.toBeNull();
    expect(parseGroupsCache(raw, NOW + CACHE_DURATION)).toBeNull();
    expect(parseGroupsCache(raw, NOW + CACHE_DURATION + 1)).toBeNull();
  });

  it('throws on malformed JSON (the caller catches and logs)', () => {
    expect(() => parseGroupsCache('{not json', NOW)).toThrow();
  });
});

describe('serializeGroupsCache', () => {
  it('round-trips through parse and stamps the timestamp', () => {
    const groups: GroupSummary[] = [
      { id: 'g1', name: 'Eng', type: 'OKTA_GROUP', memberCount: 1, hasRules: false, ruleCount: 0 },
    ];
    const raw = serializeGroupsCache(groups, NOW);
    expect(JSON.parse(raw).timestamp).toBe(NOW);
    expect(parseGroupsCache(raw, NOW)![0].id).toBe('g1');
  });
});
