import { describe, it, expect } from 'vitest';
import { profileRuleReads } from './profileRuleReads';
import type { FormattedRule, GroupMembership, OktaUser } from '../../../shared/types';

/** An obviously-fake user carrying the attributes the fixtures' rules read. */
const USER: OktaUser = {
  id: '00uFAKE0001',
  status: 'ACTIVE',
  profile: {
    login: 'user@example.com',
    email: 'user@example.com',
    firstName: 'Sam',
    lastName: 'Example',
    department: 'Engineering',
    title: 'Engineer',
    userType: 'Employee',
  },
};

const rule = (over: Partial<FormattedRule> = {}): FormattedRule => ({
  id: '0prFAKE0001',
  name: 'Engineering → VPN',
  status: 'ACTIVE',
  condition: 'department == "Engineering"',
  conditionExpression: 'user.department == "Engineering"',
  groupIds: ['00gFAKE0001'],
  userAttributes: ['department'],
  created: '2024-01-01T00:00:00.000Z',
  lastUpdated: '2024-01-01T00:00:00.000Z',
  ...over,
});

const membership = (id: string): GroupMembership => ({
  group: { id, type: 'OKTA_GROUP', profile: { name: `group.${id}` } },
  membershipType: 'RULE_BASED',
  rules: [],
  attribution: 'exact',
});

describe('profileRuleReads', () => {
  it('keys the map by the attribute Okta name, matching AttributeDescriptor.name', () => {
    const reads = profileRuleReads([rule()], USER, [membership('00gFAKE0001')]);

    expect(reads).toEqual({ department: ['Engineering → VPN'] });
    expect(reads['profile.department']).toBeUndefined();
  });

  it('omits a rule that reads an attribute but grants this user no access', () => {
    const reads = profileRuleReads(
      [
        rule(),
        rule({
          id: '0prFAKE0002',
          name: 'Contractors → Limited VPN',
          conditionExpression: 'user.department == "Engineering" && user.userType == "Contractor"',
          userAttributes: ['department', 'userType'],
          // Feeds a group this user is not in, so it grants them nothing.
          groupIds: ['00gFAKE0099'],
        }),
      ],
      USER,
      [membership('00gFAKE0001')],
    );

    expect(reads.department).toEqual(['Engineering → VPN']);
    // The non-granting rule is the only reader of userType — its absence is the
    // whole point: an unrelated rule must not inflate a chip.
    expect(reads.userType).toBeUndefined();
  });

  it('omits an INACTIVE rule even when it feeds a group the user is in', () => {
    const reads = profileRuleReads([rule({ status: 'INACTIVE' })], USER, [
      membership('00gFAKE0001'),
    ]);

    expect(reads).toEqual({});
  });

  it('counts a rule that feeds any one of the user’s groups', () => {
    const reads = profileRuleReads([rule({ groupIds: ['00gFAKE0099', '00gFAKE0002'] })], USER, [
      membership('00gFAKE0001'),
      membership('00gFAKE0002'),
    ]);

    expect(reads.department).toEqual(['Engineering → VPN']);
  });

  it('records every attribute a multi-clause condition reads', () => {
    const reads = profileRuleReads(
      [
        rule({
          conditionExpression: 'user.department == "Engineering" && user.title != "Intern"',
          userAttributes: ['department', 'title'],
        }),
      ],
      USER,
      [membership('00gFAKE0001')],
    );

    expect(reads.department).toEqual(['Engineering → VPN']);
    expect(reads.title).toEqual(['Engineering → VPN']);
  });

  it('lists every granting rule that reads one attribute, in rule order', () => {
    const reads = profileRuleReads(
      [rule(), rule({ id: '0prFAKE0002', name: 'Engineering → Wiki', groupIds: ['00gFAKE0002'] })],
      USER,
      [membership('00gFAKE0001'), membership('00gFAKE0002')],
    );

    expect(reads.department).toEqual(['Engineering → VPN', 'Engineering → Wiki']);
  });

  it('does not repeat a rule name for an attribute its condition mentions twice', () => {
    const reads = profileRuleReads(
      [
        rule({
          conditionExpression: 'user.department == "Engineering" || user.department == "Platform"',
        }),
      ],
      USER,
      [membership('00gFAKE0001')],
    );

    expect(reads.department).toEqual(['Engineering → VPN']);
  });

  it('reads a computed reference the boundary regex misses', () => {
    const reads = profileRuleReads(
      [
        rule({
          conditionExpression: 'user["costCenter"] == "1234"',
          // What `extractUserAttributes` yields for a computed reference: nothing.
          userAttributes: [],
        }),
      ],
      USER,
      [membership('00gFAKE0001')],
    );

    expect(reads.costCenter).toEqual(['Engineering → VPN']);
  });

  it('still reports references when the expression cannot be parsed', () => {
    const reads = profileRuleReads(
      [rule({ conditionExpression: 'user.department == ', userAttributes: ['department'] })],
      USER,
      [membership('00gFAKE0001')],
    );

    expect(reads.department).toEqual(['Engineering → VPN']);
  });

  it('ignores a group name that happens to look like an attribute reference', () => {
    const reads = profileRuleReads(
      [
        rule({
          conditionExpression: 'isMemberOfAnyGroupName("user.department")',
          userAttributes: [],
        }),
      ],
      USER,
      [membership('00gFAKE0001')],
    );

    expect(reads.department).toBeUndefined();
  });

  it('never surfaces a security-sensitive key a rule references', () => {
    const reads = profileRuleReads(
      [
        rule({
          conditionExpression: 'user.department == "Engineering" && user.password != null',
          userAttributes: ['department', 'password', 'securityQuestionAnswer'],
        }),
      ],
      USER,
      [membership('00gFAKE0001')],
    );

    expect(reads.department).toEqual(['Engineering → VPN']);
    expect(reads.password).toBeUndefined();
    expect(reads.securityQuestionAnswer).toBeUndefined();
  });

  it('returns an empty map when the user is in no groups at all', () => {
    expect(profileRuleReads([rule()], USER, [])).toEqual({});
  });

  it('never records an attribute with an empty rule list', () => {
    const reads = profileRuleReads(
      [rule({ conditionExpression: 'user.department == "Engineering"' })],
      USER,
      [membership('00gFAKE0001')],
    );

    expect(Object.values(reads).every((names) => names.length > 0)).toBe(true);
  });
});
