import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { groupIdentity } from './groupIdentity';
import type { GroupSummary, GroupType } from '../../../shared/types';

// Relative timestamps are computed against "now", so the clock is pinned. `4 days ago`
// otherwise stops being true the moment the fixture ages.
const NOW = new Date('2026-08-15T12:00:00.000Z');
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000);

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterAll(() => {
  vi.useRealTimers();
});

const makeGroup = (overrides: Partial<GroupSummary> = {}): GroupSummary => ({
  id: '00gFAKE1a2b3c4d5e6',
  name: 'Engineering',
  type: 'OKTA_GROUP',
  memberCount: 1284,
  hasRules: false,
  ruleCount: 0,
  ...overrides,
});

/** The three rows a group descriptor always has: identity, counts, timestamps. */
const rowsOf = (group: GroupSummary) => {
  const [identity, counts, timestamps] = groupIdentity(group).rows;
  return { identity, counts, timestamps };
};

describe('groupIdentity', () => {
  it('carries the group id as the crossfade key and the name as the title', () => {
    const identity = groupIdentity(makeGroup());

    expect(identity.key).toBe('00gFAKE1a2b3c4d5e6');
    expect(identity.name).toBe('Engineering');
  });

  it.each([
    ['OKTA_GROUP', 'Okta group', 'primary'],
    ['APP_GROUP', 'App group', 'warning'],
    ['BUILT_IN', 'Built-in', 'neutral'],
  ] as const)('demotes a %s to a "%s" status fact rather than a badge', (type, text, variant) => {
    // None of the three group types is `danger`, so the header's loud trailing badge is
    // never used for a group today — the type mark lives in the identity row instead.
    const identity = groupIdentity(makeGroup({ type }));

    expect(identity.badge).toBeUndefined();
    expect(identity.rows[0]).toContainEqual({ kind: 'status', variant, text });
  });

  it('falls back to the built-in status fact for a group type Okta added after this map', () => {
    // The union is widened by the zod boundary before this map learns the new member, so
    // the lookup has to survive a miss rather than dropping the fact from the header.
    const identity = groupIdentity(makeGroup({ type: 'DIRECTORY_GROUP' as GroupType }));

    expect(identity.badge).toBeUndefined();
    expect(identity.rows[0]).toContainEqual({
      kind: 'status',
      variant: 'neutral',
      text: 'Built-in',
    });
  });

  it('opens with the type status fact, then the copyable group id', () => {
    expect(rowsOf(makeGroup()).identity).toEqual([
      { kind: 'status', variant: 'primary', text: 'Okta group' },
      { kind: 'id', value: '00gFAKE1a2b3c4d5e6', copyLabel: 'Copy group id' },
    ]);
  });

  it('groups the member count with thousands separators', () => {
    expect(rowsOf(makeGroup({ memberCount: 1284 })).counts[0]).toMatchObject({
      kind: 'metric',
      icon: 'users',
      value: '1,284',
      label: 'members',
    });
  });

  it.each([
    [0, 'members'],
    [1, 'member'],
    [2, 'members'],
  ])('labels %i as "%s"', (memberCount, label) => {
    expect(rowsOf(makeGroup({ memberCount })).counts[0]).toMatchObject({ label });
  });

  it('reports the rules that assign members here, once there are any', () => {
    expect(rowsOf(makeGroup({ hasRules: true, ruleCount: 2 })).counts).toContainEqual(
      expect.objectContaining({ icon: 'bolt', value: '2', label: 'rules' }),
    );
  });

  it('reports the rules that merely reference the group separately', () => {
    expect(rowsOf(makeGroup({ usedInRuleCount: 3 })).counts).toContainEqual(
      expect.objectContaining({ icon: 'link', value: '3', label: 'references' }),
    );
  });

  it('says nothing about rules while the rules payload is still unknown', () => {
    // `usedInRuleCount` is undefined until the rules load, and `ruleCount` reads 0 in that
    // same window — "0 rules" would state as fact something the panel has not asked.
    const { counts } = rowsOf(makeGroup({ ruleCount: 0, usedInRuleCount: undefined }));

    expect(counts).toHaveLength(1);
    expect(counts[0]).toMatchObject({ label: 'members' });
  });

  it('drops a rule count of zero rather than stating an absence nobody asked about', () => {
    // Unlike `memberCount`, where `0 members` answers a real question, "0 references" is
    // noise beside the counts that matter — and indistinguishable from "not loaded".
    const { counts } = rowsOf(makeGroup({ usedInRuleCount: 0 }));

    expect(counts.map((fact) => ('label' in fact ? fact.label : fact.kind))).toEqual(['members']);
  });

  it('renders created as an absolute date and both update clocks as recency', () => {
    const { timestamps } = rowsOf(
      makeGroup({
        created: daysAgo(1600),
        lastUpdated: daysAgo(4),
        lastMembershipUpdated: daysAgo(900),
      }),
    );

    expect(timestamps[0]).toMatchObject({ kind: 'text', icon: 'clock' });
    expect((timestamps[0] as { text: string }).text).toMatch(/^Created /);
    expect(timestamps[1]).toMatchObject({ kind: 'text', text: 'Profile 4 days ago' });
    expect(timestamps[2]).toMatchObject({ kind: 'text', text: 'Membership 2 years ago' });
  });

  it('names which clock each chip reports, so a fresh profile cannot read as a fresh roster', () => {
    // The regression this pins: the profile chip used to say a bare "Updated",
    // which invites reading a rename as activity. This group was renamed four days
    // ago and has not gained or lost a member in nearly three years — the two
    // chips must not be confusable.
    const { timestamps } = rowsOf(
      makeGroup({ lastUpdated: daysAgo(4), lastMembershipUpdated: daysAgo(900) }),
    );

    const texts = timestamps.map((fact) => ('text' in fact ? fact.text : ''));
    expect(texts).toEqual(['Profile 4 days ago', 'Membership 2 years ago']);
  });

  it('omits the membership chip when Okta reported no membership date', () => {
    // A snapshot synced before the field was parsed carries no value; the chip is
    // dropped rather than rendered as an absence.
    const { timestamps } = rowsOf(makeGroup({ lastUpdated: daysAgo(4) }));

    expect(timestamps.map((fact) => ('text' in fact ? fact.text : ''))).toEqual([
      'Profile 4 days ago',
    ]);
  });

  it('leaves the timestamp row empty when Okta reported neither date', () => {
    // An empty row is dropped by `EntityIdentity`, so the region shrinks instead of
    // showing a placeholder.
    expect(rowsOf(makeGroup()).timestamps).toEqual([]);
  });

  it('links to the group in the Admin Console', () => {
    expect(groupIdentity(makeGroup()).link).toEqual({
      entityType: 'group',
      entityId: '00gFAKE1a2b3c4d5e6',
    });
  });
});
