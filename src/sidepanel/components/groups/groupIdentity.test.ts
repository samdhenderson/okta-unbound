import { describe, it, expect } from 'vitest';
import { groupIdentity } from './groupIdentity';
import type { GroupSummary, GroupType } from '../../../shared/types';

const makeGroup = (overrides: Partial<GroupSummary> = {}): GroupSummary => ({
  id: '00gFAKE1a2b3c4d5e6',
  name: 'Engineering',
  type: 'OKTA_GROUP',
  memberCount: 1284,
  hasRules: false,
  ruleCount: 0,
  ...overrides,
});

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
  ] as const)('badges a %s as "%s"', (type, text, variant) => {
    expect(groupIdentity(makeGroup({ type })).badge).toEqual({ text, variant });
  });

  it('falls back to the built-in badge for a group type Okta added after this map', () => {
    // The union is widened by the zod boundary before this map learns the new member, so
    // the lookup has to survive a miss rather than emit `undefined` into the header.
    const identity = groupIdentity(makeGroup({ type: 'DIRECTORY_GROUP' as GroupType }));

    expect(identity.badge).toEqual({ text: 'Built-in', variant: 'neutral' });
  });

  it('groups the member count with thousands separators', () => {
    expect(groupIdentity(makeGroup({ memberCount: 1284 })).lines).toEqual([
      { kind: 'metric', icon: 'users', value: '1,284', label: 'members' },
    ]);
  });

  it.each([
    [0, 'members'],
    [1, 'member'],
    [2, 'members'],
  ])('labels %i as "%s"', (memberCount, label) => {
    const [line] = groupIdentity(makeGroup({ memberCount })).lines;

    expect(line).toMatchObject({ label, value: String(memberCount) });
  });

  it('links to the group in the Admin Console', () => {
    expect(groupIdentity(makeGroup()).link).toEqual({
      entityType: 'group',
      entityId: '00gFAKE1a2b3c4d5e6',
    });
  });
});
