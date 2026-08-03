/**
 * Unit tests for `analyzeMemberships` — the unified, exclusion-aware heuristic
 * shared by UsersTab, UserOverview, and the user comparison.
 */
import { describe, it, expect } from 'vitest';
import { analyzeMemberships } from './membershipAnalysis';
import type { OktaGroup, OktaUser, MembershipRule } from '../types';

function group(over: Partial<OktaGroup> = {}): OktaGroup {
  return {
    id: 'g1',
    type: 'OKTA_GROUP',
    created: '2020-01-01T00:00:00.000Z',
    lastUpdated: '2024-01-01T00:00:00.000Z',
    profile: { name: 'Engineering', description: '' },
    ...over,
  } as OktaGroup;
}

function rule(over: Partial<MembershipRule> = {}): MembershipRule {
  return { id: 'r1', name: 'Rule 1', status: 'ACTIVE', groupIds: ['g1'], ...over };
}

const user: OktaUser = {
  id: 'u1',
  status: 'ACTIVE',
  profile: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@x.com', login: 'ada@x.com' },
} as OktaUser;

describe('analyzeMemberships', () => {
  it('returns [] for no groups', () => {
    expect(analyzeMemberships([], [rule()], user)).toEqual([]);
  });

  it('classifies APP_GROUP as RULE_BASED with no rule, even absent any rules', () => {
    const [m] = analyzeMemberships([group({ id: 'a', type: 'APP_GROUP' })], [], user);
    expect(m.membershipType).toBe('RULE_BASED');
    expect(m.rule).toBeUndefined();
  });

  it('classifies a group with no matching active rules as DIRECT', () => {
    const [m] = analyzeMemberships([group({ id: 'g2' })], [rule({ groupIds: ['other'] })], user);
    expect(m.membershipType).toBe('DIRECT');
    expect(m.rule).toBeUndefined();
  });

  it('ignores INACTIVE rules (→ DIRECT)', () => {
    const [m] = analyzeMemberships([group()], [rule({ status: 'INACTIVE' })], user);
    expect(m.membershipType).toBe('DIRECT');
  });

  it('classifies a group with a matching active rule as RULE_BASED and attributes it', () => {
    const r = rule({ id: 'rX', groupIds: ['g1'] });
    const [m] = analyzeMemberships([group()], [r], user);
    expect(m.membershipType).toBe('RULE_BASED');
    expect(m.rule?.id).toBe('rX');
  });

  it('matches on actions.assignUserToGroups.groupIds when groupIds is absent', () => {
    const r = rule({
      id: 'rA',
      groupIds: undefined,
      actions: { assignUserToGroups: { groupIds: ['g1'] } },
    });
    const [m] = analyzeMemberships([group()], [r], user);
    expect(m.membershipType).toBe('RULE_BASED');
    expect(m.rule?.id).toBe('rA');
  });

  it('defaults attribution to the first matching rule (low confidence)', () => {
    const first = rule({ id: 'first' });
    const second = rule({ id: 'second' });
    const [m] = analyzeMemberships([group()], [first, second], user);
    expect(m.rule?.id).toBe('first');
  });

  it('classifies as DIRECT when the user is excluded from every matching rule', () => {
    const excluding = rule({
      id: 'exc',
      conditions: { people: { users: { exclude: ['u1'] } } },
    });
    const [m] = analyzeMemberships([group()], [excluding], user);
    expect(m.membershipType).toBe('DIRECT');
    expect(m.rule).toBeUndefined();
  });

  it('stays RULE_BASED and attributes to a non-excluding rule when excluded from only some', () => {
    const excluding = rule({ id: 'exc', conditions: { people: { users: { exclude: ['u1'] } } } });
    const keeps = rule({ id: 'keeps' });
    const [m] = analyzeMemberships([group()], [excluding, keeps], user);
    expect(m.membershipType).toBe('RULE_BASED');
    // attribution comes from the non-excluding set, not the first matching rule
    expect(m.rule?.id).toBe('keeps');
  });

  it('marks a rule with no condition expression as inferred (nothing to evaluate)', () => {
    const [m] = analyzeMemberships([group()], [rule({ id: 'rX' })], user);
    expect(m.membershipType).toBe('RULE_BASED');
    expect(m.attribution).toBe('inferred');
  });

  it('prefers a rule whose referenced attribute value appears in its condition', () => {
    const engUser = {
      ...user,
      profile: { ...user.profile, department: 'Engineering' },
    } as OktaUser;
    const plain = rule({ id: 'plain' });
    const matching = rule({
      id: 'matching',
      userAttributes: ['department'],
      conditions: {
        expression: { value: 'user.department == "engineering"', type: 'urn:okta:expression:1.0' },
      },
    });
    const [m] = analyzeMemberships([group()], [plain, matching], engUser);
    expect(m.rule?.id).toBe('matching');
  });
});

// ===========================================================================
// Condition evaluation (WP3). A member is only rule-managed if they actually
// satisfy a feeding rule's condition — and when a condition cannot be read,
// the classifier says so instead of guessing silently.
// ===========================================================================
describe('analyzeMemberships — condition evaluation', () => {
  const engUser = {
    ...user,
    profile: { ...user.profile, department: 'Engineering' },
  } as OktaUser;

  function ruleWith(expression: string, over: Partial<MembershipRule> = {}): MembershipRule {
    return rule({ conditionExpression: expression, ...over });
  }

  it('attributes the rule the user actually matches, not the first one', () => {
    const sales = ruleWith('user.department == "Sales"', { id: 'sales' });
    const eng = ruleWith('user.department == "Engineering"', { id: 'eng' });
    const [m] = analyzeMemberships([group()], [sales, eng], engUser);
    expect(m.membershipType).toBe('RULE_BASED');
    expect(m.rule?.id).toBe('eng');
    expect(m.attribution).toBe('exact');
  });

  it('reads the condition from conditions.expression.value too', () => {
    const eng = rule({
      id: 'eng',
      conditions: {
        expression: { value: 'user.department == "Engineering"', type: 'urn:okta:expression:1.0' },
      },
    });
    const [m] = analyzeMemberships([group()], [eng], engUser);
    expect(m.membershipType).toBe('RULE_BASED');
    expect(m.attribution).toBe('exact');
  });

  it('THE FIX: a hand-added member of a rule-fed group is DIRECT, not rule-managed', () => {
    // The user is in the group but satisfies none of its feeding rules — the
    // only way that happens is a manual add.
    const sales = ruleWith('user.department == "Sales"', { id: 'sales' });
    const finance = ruleWith('user.department == "Finance"', { id: 'finance' });
    const [m] = analyzeMemberships([group()], [sales, finance], engUser);
    expect(m.membershipType).toBe('DIRECT');
    expect(m.rule).toBeUndefined();
    expect(m.attribution).toBe('exact');
  });

  it('falls back to the heuristic — flagged inferred — when ANY feeding rule is unevaluable', () => {
    const unevaluable = ruleWith('isMemberOfGroup("00gFAKE")', { id: 'unevaluable' });
    const sales = ruleWith('user.department == "Sales"', { id: 'sales' });
    const [m] = analyzeMemberships([group()], [unevaluable, sales], engUser);
    // Not DIRECT: the unevaluable rule might well be what put them here.
    expect(m.membershipType).toBe('RULE_BASED');
    expect(m.attribution).toBe('inferred');
  });

  it('prefers an exact match even when another feeding rule is unevaluable', () => {
    const unevaluable = ruleWith('isMemberOfGroup("00gFAKE")', { id: 'unevaluable' });
    const eng = ruleWith('user.department == "Engineering"', { id: 'eng' });
    const [m] = analyzeMemberships([group()], [unevaluable, eng], engUser);
    expect(m.rule?.id).toBe('eng');
    expect(m.attribution).toBe('exact');
  });

  it('treats an ungrammatical condition as unevaluable, never as "does not match"', () => {
    const broken = ruleWith('user.department ==', { id: 'broken' });
    const [m] = analyzeMemberships([group()], [broken], engUser);
    expect(m.membershipType).toBe('RULE_BASED');
    expect(m.membershipType).not.toBe('DIRECT');
    expect(m.attribution).toBe('inferred');
  });

  it('treats an unsupported operator as unevaluable, never as "does not match"', () => {
    const unsupported = ruleWith('String.substring(user.department, 0, 3) == "Eng"', {
      id: 'unsupported',
    });
    const [m] = analyzeMemberships([group()], [unsupported], engUser);
    expect(m.membershipType).toBe('RULE_BASED');
    expect(m.attribution).toBe('inferred');
  });

  it('ignores a non-matching rule the user is excluded from', () => {
    // Exclusion is applied first, so the remaining evaluable rule decides.
    const excluded = ruleWith('user.department == "Engineering"', {
      id: 'excluded',
      conditions: { people: { users: { exclude: ['u1'] } } },
    });
    const other = ruleWith('user.department == "Sales"', { id: 'other' });
    const [m] = analyzeMemberships([group()], [excluded, other], engUser);
    expect(m.membershipType).toBe('DIRECT');
    expect(m.attribution).toBe('exact');
  });

  it('labels the fact-based branches exact', () => {
    const [appGroup] = analyzeMemberships([group({ id: 'a', type: 'APP_GROUP' })], [], user);
    expect(appGroup.attribution).toBe('exact');

    const [noRules] = analyzeMemberships([group()], [], user);
    expect(noRules.attribution).toBe('exact');

    const [allExcluded] = analyzeMemberships(
      [group()],
      [rule({ conditions: { people: { users: { exclude: ['u1'] } } } })],
      user,
    );
    expect(allExcluded.attribution).toBe('exact');
  });
});
