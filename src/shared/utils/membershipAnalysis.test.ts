/**
 * Unit tests for `analyzeMemberships` — the unified, exclusion-aware heuristic
 * shared by UsersTab, UserOverview, and the user comparison.
 */
import { describe, it, expect } from 'vitest';
import {
  analyzeMemberships,
  attributionNamesRules,
  attributionSemantics,
  isDeducedAttribution,
  unclassifiedMemberships,
} from './membershipAnalysis';
import type { OktaGroup, OktaUser, MembershipRule, MembershipAttribution } from '../types';

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
    expect(m.rules).toEqual([]);
  });

  it('classifies a group with no matching active rules as DIRECT', () => {
    const [m] = analyzeMemberships([group({ id: 'g2' })], [rule({ groupIds: ['other'] })], user);
    expect(m.membershipType).toBe('DIRECT');
    expect(m.rules).toEqual([]);
  });

  it('ignores INACTIVE rules (→ DIRECT)', () => {
    const [m] = analyzeMemberships([group()], [rule({ status: 'INACTIVE' })], user);
    expect(m.membershipType).toBe('DIRECT');
  });

  it('classifies a group with a matching active rule as RULE_BASED and attributes it', () => {
    const r = rule({ id: 'rX', groupIds: ['g1'] });
    const [m] = analyzeMemberships([group()], [r], user);
    expect(m.membershipType).toBe('RULE_BASED');
    expect(m.rules.map((r) => r.id)).toEqual(['rX']);
  });

  it('matches on actions.assignUserToGroups.groupIds when groupIds is absent', () => {
    const r = rule({
      id: 'rA',
      groupIds: undefined,
      actions: { assignUserToGroups: { groupIds: ['g1'] } },
    });
    const [m] = analyzeMemberships([group()], [r], user);
    expect(m.membershipType).toBe('RULE_BASED');
    expect(m.rules.map((r) => r.id)).toEqual(['rA']);
  });

  it('defaults attribution to the first matching rule (low confidence)', () => {
    const first = rule({ id: 'first' });
    const second = rule({ id: 'second' });
    const [m] = analyzeMemberships([group()], [first, second], user);
    expect(m.rules[0]?.id).toBe('first');
    // …but the positional pick is now labelled as one. Neither candidate has any
    // evidence behind it, so both are carried and the attribution says plainly
    // that which of them (if either) granted the membership is unknown.
    expect(m.rules.map((r) => r.id)).toEqual(['first', 'second']);
    expect(m.attribution).toBe('ambiguous');
  });

  it('classifies as DIRECT when the user is excluded from every matching rule', () => {
    const excluding = rule({
      id: 'exc',
      conditions: { people: { users: { exclude: ['u1'] } } },
    });
    const [m] = analyzeMemberships([group()], [excluding], user);
    expect(m.membershipType).toBe('DIRECT');
    expect(m.rules).toEqual([]);
  });

  it('stays RULE_BASED and attributes to a non-excluding rule when excluded from only some', () => {
    const excluding = rule({ id: 'exc', conditions: { people: { users: { exclude: ['u1'] } } } });
    const keeps = rule({ id: 'keeps' });
    const [m] = analyzeMemberships([group()], [excluding, keeps], user);
    expect(m.membershipType).toBe('RULE_BASED');
    // attribution comes from the non-excluding set, not the first matching rule
    expect(m.rules.map((r) => r.id)).toEqual(['keeps']);
  });

  it('marks a rule with no condition expression as inferred (nothing to evaluate)', () => {
    const [m] = analyzeMemberships([group()], [rule({ id: 'rX' })], user);
    expect(m.membershipType).toBe('RULE_BASED');
    expect(m.attribution).toBe('inferred');
  });

  // FLIPPED (ADR-0012, pre-approved): this case used to assert
  // `expect(m.rule?.id).toBe('matching')` under the title "prefers a rule whose
  // referenced attribute value appears in its condition". It pinned a defect —
  // the rule it named `matching` does not match: Okta's `==` is case-sensitive,
  // so `user.department == "engineering"` against `Engineering` evaluates to a
  // definitive `no-match`. The coarse scorer only ever saw it because it was run
  // over rules the evaluator had already ruled out.
  it('never credits a rule the evaluator PROVED does not match, however well it scores', () => {
    const engUser = {
      ...user,
      profile: { ...user.profile, department: 'Engineering' },
    } as OktaUser;
    const plain = rule({ id: 'plain' });
    // Scores perfectly on the coarse heuristic — the user's own department value
    // appears verbatim in the condition text — and still provably does not apply.
    const scoresButProvenNoMatch = rule({
      id: 'matching',
      userAttributes: ['department'],
      conditions: {
        expression: { value: 'user.department == "engineering"', type: 'urn:okta:expression:1.0' },
      },
    });
    const [m] = analyzeMemberships([group()], [plain, scoresButProvenNoMatch], engUser);
    expect(m.rules.map((r) => r.id)).toEqual(['plain']);
    // `plain` has no expression, so it is unevaluable — but it is the only
    // candidate left standing, which is evidence enough to name it.
    expect(m.attribution).toBe('inferred');
  });

  it('scores an unevaluable rule whose condition names the user’s own attribute value', () => {
    const engUser = {
      ...user,
      profile: { ...user.profile, department: 'Engineering' },
    } as OktaUser;
    const plain = rule({ id: 'plain' });
    // Unevaluable (isMemberOfGroup is outside the client-side subset), so the
    // scorer gets a say — and the department value is right there in the text.
    const scores = rule({
      id: 'scores',
      userAttributes: ['department'],
      conditionExpression: 'isMemberOfGroup("00gFAKE") OR user.dept == "Engineering"',
    });
    const [m] = analyzeMemberships([group()], [plain, scores], engUser);
    expect(m.rules.map((r) => r.id)).toEqual(['scores']);
    expect(m.attribution).toBe('inferred');
  });
});

// ===========================================================================
// Multiple matches, and labelling a guess as a guess. Two rules can genuinely
// put the same user in the same group, and when nothing separates two
// candidates the classifier must say so rather than return array position.
// ===========================================================================
describe('analyzeMemberships — plural attribution and guess labelling', () => {
  const engUser = {
    ...user,
    profile: { ...user.profile, department: 'Engineering' },
  } as OktaUser;

  function ruleWith(expression: string, over: Partial<MembershipRule> = {}): MembershipRule {
    return rule({ conditionExpression: expression, ...over });
  }

  it('carries EVERY rule the user provably matches, not just the first', () => {
    const byDept = ruleWith('user.department == "Engineering"', { id: 'byDept' });
    const byLogin = ruleWith('user.login == "ada@x.com"', { id: 'byLogin' });
    const [m] = analyzeMemberships([group()], [byDept, byLogin], engUser);
    expect(m.membershipType).toBe('RULE_BASED');
    expect(m.rules.map((r) => r.id)).toEqual(['byDept', 'byLogin']);
    expect(m.attribution).toBe('exact');
  });

  it('keeps a proven match exact even when a sibling rule is unevaluable', () => {
    const opaque = ruleWith('isMemberOfGroup("00gFAKE")', { id: 'opaque' });
    const byDept = ruleWith('user.department == "Engineering"', { id: 'byDept' });
    const [m] = analyzeMemberships([group()], [opaque, byDept], engUser);
    expect(m.rules.map((r) => r.id)).toEqual(['byDept']);
    expect(m.attribution).toBe('exact');
  });

  it('calls a sole surviving candidate inferred — nothing else could explain it', () => {
    const opaque = ruleWith('isMemberOfGroup("00gFAKE")', { id: 'opaque' });
    const provenNoMatch = ruleWith('user.department == "Sales"', { id: 'sales' });
    const [m] = analyzeMemberships([group()], [opaque, provenNoMatch], engUser);
    expect(m.rules.map((r) => r.id)).toEqual(['opaque']);
    expect(m.attribution).toBe('inferred');
  });

  it('calls two indistinguishable candidates ambiguous and carries BOTH', () => {
    const opaqueA = ruleWith('isMemberOfGroup("00gFAKE1")', { id: 'opaqueA' });
    const opaqueB = ruleWith('isMemberOfGroup("00gFAKE2")', { id: 'opaqueB' });
    const [m] = analyzeMemberships([group()], [opaqueA, opaqueB], engUser);
    expect(m.membershipType).toBe('RULE_BASED');
    // Not `[opaqueA]`: array position is not evidence, so the candidate set is
    // reported whole and the label says it is unresolved.
    expect(m.rules.map((r) => r.id)).toEqual(['opaqueA', 'opaqueB']);
    expect(m.attribution).toBe('ambiguous');
  });

  it('excludes a proven no-match from the ambiguous candidate set', () => {
    const opaqueA = ruleWith('isMemberOfGroup("00gFAKE1")', { id: 'opaqueA' });
    const opaqueB = ruleWith('isMemberOfGroup("00gFAKE2")', { id: 'opaqueB' });
    const provenNoMatch = ruleWith('user.department == "Sales"', { id: 'sales' });
    const [m] = analyzeMemberships([group()], [opaqueA, provenNoMatch, opaqueB], engUser);
    expect(m.rules.map((r) => r.id)).toEqual(['opaqueA', 'opaqueB']);
    expect(m.attribution).toBe('ambiguous');
  });

  it('excludes a rule the user is excluded from the candidate set', () => {
    const opaqueA = ruleWith('isMemberOfGroup("00gFAKE1")', { id: 'opaqueA' });
    const opaqueExcluding = ruleWith('isMemberOfGroup("00gFAKE2")', {
      id: 'opaqueExcluding',
      conditions: { people: { users: { exclude: ['u1'] } } },
    });
    const [m] = analyzeMemberships([group()], [opaqueA, opaqueExcluding], engUser);
    expect(m.rules.map((r) => r.id)).toEqual(['opaqueA']);
    expect(m.attribution).toBe('inferred');
  });

  it('never leaves attribution unset — every branch labels its evidence', () => {
    const memberships = analyzeMemberships(
      [group({ id: 'a', type: 'APP_GROUP' }), group({ id: 'g1' }), group({ id: 'g9' })],
      [rule({ id: 'opaque', conditionExpression: 'isMemberOfGroup("00gFAKE")' })],
      engUser,
    );
    for (const m of memberships) {
      expect(['exact', 'inferred', 'ambiguous']).toContain(m.attribution);
      expect(Array.isArray(m.rules)).toBe(true);
    }
  });
});

// ===========================================================================
// The attribution vocabulary, as the exhaustive tables express it.
// ===========================================================================
describe('attribution semantics', () => {
  it('treats only `exact` as a fact', () => {
    expect(isDeducedAttribution('exact')).toBe(false);
    expect(isDeducedAttribution('inferred')).toBe(true);
    expect(isDeducedAttribution('ambiguous')).toBe(true);
  });

  it('refuses to name rules for an unevidenced guess', () => {
    expect(attributionNamesRules('exact')).toBe(true);
    expect(attributionNamesRules('inferred')).toBe(true);
    expect(attributionNamesRules('ambiguous')).toBe(false);
  });

  it('describes every attribution class', () => {
    const classes: MembershipAttribution[] = ['exact', 'inferred', 'ambiguous'];
    for (const attribution of classes) {
      const semantics = attributionSemantics(attribution);
      expect(['fact', 'deduction']).toContain(semantics.evidence);
      expect(typeof semantics.namesRules).toBe('boolean');
    }
  });
});

describe('unclassifiedMemberships', () => {
  it('says "unknown", never "added by hand", for every group', () => {
    // The whole point: a caller without a rule inventory must not go through
    // `analyzeMemberships`, which would read the missing rules as "no rule
    // targets this group" and answer DIRECT/exact — a fact it does not have.
    const groups = [group({ id: 'g1' }), group({ id: 'g2', type: 'APP_GROUP' })];

    const result = unclassifiedMemberships(groups);

    expect(result.map((m) => m.group.id)).toEqual(['g1', 'g2']);
    for (const membership of result) {
      expect(membership.membershipType).toBe('UNKNOWN');
      expect(membership.attribution).toBe('ambiguous');
      expect(membership.rules).toEqual([]);
      expect(isDeducedAttribution(membership.attribution)).toBe(true);
      expect(attributionNamesRules(membership.attribution)).toBe(false);
    }
  });

  it('gives every membership its own rules array', () => {
    const [first, second] = unclassifiedMemberships([group({ id: 'g1' }), group({ id: 'g2' })]);
    expect(first.rules).not.toBe(second.rules);
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
    expect(m.rules.map((r) => r.id)).toEqual(['eng']);
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
    expect(m.rules).toEqual([]);
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
    expect(m.rules.map((r) => r.id)).toEqual(['eng']);
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
