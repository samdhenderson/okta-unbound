/**
 * @module shared/membership/blastRadius.test
 * @description **Every withhold is tested as a pair.**
 *
 * A one-sided assertion here would pass for the wrong reason: an engine that
 * returned `not-predicted` for absolutely everything satisfies half of these
 * cases perfectly. So each case that expects a prediction to be *withheld* is
 * followed by a **mirror** that flips exactly one fixture field — the field the
 * gate reads, and nothing else — and expects `removed`. If the mirror
 * fails the gate is over-eager; if the withhold fails the gate is missing; and
 * because the two fixtures differ in one field, a green pair localises the
 * behaviour to that field.
 *
 * The load-bearing case is "an unevaluable rule is never turned into a no"
 * (ADR-0017, ADR-0020): a second ACTIVE rule feeding the group that this panel
 * declines to evaluate must withhold the removal, because "we could not tell
 * whether it still holds them" is not "it does not hold them".
 *
 * Fixtures use obviously fake Okta ids (`00u…`, `00g…`, `0pr…`) and
 * `@example.com` addresses. Nothing here asserts CSS classes or referential
 * identity (ADR-0023).
 */

import { describe, it, expect } from 'vitest';
import { analyzeBlastRadius } from './blastRadius';
import { groupContextOf } from './groupContext';
import type { BlastRadiusReport, RuleInventoryState } from './blastRadiusTypes';
import { classifyAccessCauses } from '../../sidepanel/components/users/comparison/accessCause';
import type { GroupMembership, GroupType, MembershipRule, OktaGroup, OktaUser } from '../types';
// Type-only, and the point of the import: it pins at COMPILE time that the local
// `RuleInventoryState` still accepts the hook's, so the deliberate copy in
// `blastRadiusTypes` cannot drift from the hook that feeds it. `import type` is
// erased, so no React hook is pulled into this unit test at run time.
import type { RuleInventoryState as HookRuleInventoryState } from '../../sidepanel/hooks/useUserMemberships';

// ---------------------------------------------------------------------------
// Fixtures. Hand-rolled: `src/test/factories/` holds only `coreApi.ts`, and no
// membership/rule/user factory exists to reuse (the neighbouring
// `attributionParity.test.ts` builds its own for the same reason).
// ---------------------------------------------------------------------------

const group = (id: string, name: string, type: GroupType = 'OKTA_GROUP'): OktaGroup => ({
  id,
  type,
  profile: { name },
});

const ENGINEERING = group('00gFAKEeng', 'Engineering');
const FINANCE = group('00gFAKEfin', 'Finance');
const NEW_HIRES = group('00gFAKEnew', 'New Hires');
const SALESFORCE = group('00gFAKEapp', 'Salesforce Users', 'APP_GROUP');
const ALPHA = group('00gFAKEalpha', 'Alpha Access');
const ZEBRA = group('00gFAKEzebra', 'Zebra Access');

const ALL_GROUPS = [ENGINEERING, FINANCE, NEW_HIRES, SALESFORCE, ALPHA, ZEBRA];
const GROUP_NAMES = new Map(ALL_GROUPS.map((g) => [g.id, g.profile.name]));

/** A user with the four required profile fields plus whatever the case needs. */
function userWith(profile: Record<string, unknown> = {}): OktaUser {
  return {
    id: '00uFAKEuser',
    status: 'ACTIVE',
    profile: {
      login: 'user@example.com',
      email: 'user@example.com',
      firstName: 'Test',
      lastName: 'User',
      ...profile,
    },
  };
}

/** The user every case starts from: in Engineering, department `Eng`, title `Staff`. */
const USER = userWith({ department: 'Eng', title: 'Staff' });

/** The edit under test: the department that feeds Engineering is being changed. */
const DRAFT = { department: 'Sales' };

/**
 * A membership. The defaults describe the *unhedged rule-fed* case — the only
 * one that can reach `removed` — so every withhold fixture below is one
 * named override away from its own mirror.
 */
function membershipOf(group: OktaGroup, overrides: Partial<GroupMembership> = {}): GroupMembership {
  return {
    group,
    membershipType: 'RULE_BASED',
    rules: [],
    attribution: 'exact',
    ...overrides,
  };
}

function ruleOf(overrides: Partial<MembershipRule> & Pick<MembershipRule, 'id'>): MembershipRule {
  return {
    name: `Rule ${overrides.id}`,
    status: 'ACTIVE',
    groupIds: [],
    conditionExpression: 'true',
    userAttributes: [],
    ...overrides,
  };
}

/** ACTIVE, feeds Engineering, and stops matching the moment `department` moves. */
const ENG_FEEDER = ruleOf({
  id: '0prFAKEeng',
  name: 'Engineering feeder',
  groupIds: [ENGINEERING.id],
  conditionExpression: 'user.department=="Eng"',
  userAttributes: ['department'],
});

/** ACTIVE, also feeds Engineering, and is untouched by the draft — a blocker. */
const STAFF_FEEDER = ruleOf({
  id: '0prFAKEstaff',
  name: 'Staff feeder',
  groupIds: [ENGINEERING.id],
  conditionExpression: 'user.title=="Staff"',
  userAttributes: ['title'],
});

/**
 * ACTIVE, feeds Engineering, and stays unevaluable.
 *
 * Tenant regexes are evaluated now (ADR-0002), so the pattern carries a
 * lookahead — outside the safe engine's subset, and therefore declined rather
 * than approximated. The fixture's job is unchanged: be the rule whose answer
 * this panel does not have.
 */
const REGEX_FEEDER = ruleOf({
  id: '0prFAKEregex',
  name: 'Regex feeder',
  groupIds: [ENGINEERING.id],
  conditionExpression: 'isMemberOfGroupNameRegex("(?=Eng).*")',
});

/** The membership Engineering is held by, credited to `ENG_FEEDER` beyond doubt. */
const ENG_BY_RULE = membershipOf(ENGINEERING, { rules: [ENG_FEEDER], attribution: 'exact' });

interface Scenario {
  user?: OktaUser;
  draft?: Record<string, unknown>;
  memberships?: GroupMembership[];
  rules?: MembershipRule[] | RuleInventoryState;
  groupNames?: ReadonlyMap<string, string>;
}

/** Run the engine over the standard fixture, overriding only what a case needs. */
function analyze(scenario: Scenario = {}): BlastRadiusReport {
  const rules = scenario.rules ?? [];
  return analyzeBlastRadius({
    user: scenario.user ?? USER,
    draft: scenario.draft ?? DRAFT,
    memberships: scenario.memberships ?? [ENG_BY_RULE],
    rules: Array.isArray(rules) ? { status: 'available', rules } : rules,
    groupNames: scenario.groupNames ?? GROUP_NAMES,
  });
}

/** The single group effect a case produces, asserted to be single. */
function onlyGroup(report: BlastRadiusReport) {
  expect(report.groups).toHaveLength(1);
  return report.groups[0];
}

// ---------------------------------------------------------------------------
// 1. Another ACTIVE rule still matches
// ---------------------------------------------------------------------------

describe('a second rule that still matches withholds the removal', () => {
  it('names the blocking rule instead of predicting a loss', () => {
    const report = analyze({ rules: [ENG_FEEDER, STAFF_FEEDER] });

    expect(onlyGroup(report)).toMatchObject({
      groupId: ENGINEERING.id,
      kind: 'not-predicted',
      withheldReason: 'another-active-rule-still-matches',
      blockingRuleName: STAFF_FEEDER.name,
      currentlyHeld: true,
      currentBucket: 'rule',
    });
    expect(report.counts.removed).toBe(0);
    expect(report.counts.notPredicted).toBe(1);
  });

  it('MIRROR: with the blocking rule gone, the same fixture loses the group', () => {
    const report = analyze({ rules: [ENG_FEEDER] });

    expect(onlyGroup(report)).toMatchObject({
      groupId: ENGINEERING.id,
      kind: 'removed',
      ruleId: ENG_FEEDER.id,
      ruleName: ENG_FEEDER.name,
    });
    expect(report.groups[0].withheldReason).toBeUndefined();
    expect(report.counts.removed).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 2. A membership Okta credits to nobody
// ---------------------------------------------------------------------------

describe('a membership not credited to a rule withholds the removal', () => {
  it('declines when Okta itself says no rule feeds it', () => {
    const membership = membershipOf(ENGINEERING, {
      rules: [ENG_FEEDER],
      provenance: { source: 'okta', rules: [] },
    });
    const report = analyze({ rules: [ENG_FEEDER], memberships: [membership] });

    expect(onlyGroup(report)).toMatchObject({
      kind: 'not-predicted',
      withheldReason: 'membership-not-credited-to-rule',
      // Straight from `membershipVerdict`'s classifier, not a second reading.
      currentBucket: 'direct',
    });
    expect(report.counts.removed).toBe(0);
  });

  it('MIRROR: the same provenance naming the rule predicts the loss', () => {
    const membership = membershipOf(ENGINEERING, {
      rules: [ENG_FEEDER],
      provenance: { source: 'okta', rules: [{ id: ENG_FEEDER.id, name: ENG_FEEDER.name }] },
    });
    const report = analyze({ rules: [ENG_FEEDER], memberships: [membership] });

    expect(onlyGroup(report)).toMatchObject({ kind: 'removed', currentBucket: 'rule' });
    expect(report.counts.removed).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 3. A deduced attribution
// ---------------------------------------------------------------------------

describe('a deduced attribution withholds the removal', () => {
  // Both deducing classes are asserted, one case each, because the two reach the
  // gate by different routes and only one of them used to be visible here. Gate 5
  // once read `membershipVerdict(m).label !== 'Rule'`, so it was coupled to badge
  // copy rather than to evidence: `ambiguous` declined only because its label
  // happens to carry a count, and when the badges stopped hedging their wording
  // `inferred` silently started passing the gate. The gate now reads
  // `isMembershipAttributionDeduced`, and both cases are pinned so a copy change
  // can never move a prediction again.
  it('declines when the classifier merely inferred which rule fed it', () => {
    const membership = membershipOf(ENGINEERING, {
      rules: [ENG_FEEDER],
      attribution: 'inferred',
    });
    const report = analyze({ rules: [ENG_FEEDER], memberships: [membership] });

    expect(onlyGroup(report)).toMatchObject({
      kind: 'not-predicted',
      withheldReason: 'membership-attribution-deduced',
      // Rule-bucketed — so gate 4 passed and gate 5 is genuinely what fired.
      currentBucket: 'rule',
    });
    expect(report.counts.removed).toBe(0);
  });

  it('declines while the classifier is only guessing which rule fed it', () => {
    const membership = membershipOf(ENGINEERING, {
      rules: [ENG_FEEDER, STAFF_FEEDER],
      attribution: 'ambiguous',
    });
    const report = analyze({ rules: [ENG_FEEDER], memberships: [membership] });

    expect(onlyGroup(report)).toMatchObject({
      kind: 'not-predicted',
      withheldReason: 'membership-attribution-deduced',
      // Rule-bucketed — so gate 4 passed and gate 5 is genuinely what fired.
      currentBucket: 'rule',
    });
    expect(report.counts.removed).toBe(0);
  });

  it('MIRROR: one rule and an exact attribution predicts the loss', () => {
    const membership = membershipOf(ENGINEERING, {
      rules: [ENG_FEEDER],
      attribution: 'exact',
    });
    const report = analyze({ rules: [ENG_FEEDER], memberships: [membership] });

    expect(onlyGroup(report)).toMatchObject({ kind: 'removed' });
    expect(report.counts.removed).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 4. THE ADR-0020 CASE: an unevaluable rule is never turned into a "no"
// ---------------------------------------------------------------------------

describe('an unevaluable sibling rule is never read as a no (ADR-0020)', () => {
  it('withholds the removal rather than assuming the regex rule fails too', () => {
    const report = analyze({ rules: [ENG_FEEDER, REGEX_FEEDER] });

    const effect = onlyGroup(report);
    expect(effect.kind).not.toBe('removed');
    expect(effect).toMatchObject({
      kind: 'not-predicted',
      withheldReason: 'rule-unevaluable-after',
    });
    expect(report.counts.removed).toBe(0);

    // And the reason really is the one the UI will render, carried as a code. The
    // row reads `unchanged-unevaluable` because its condition reads no attribute
    // this draft touches — but the *group* decision above is unmoved by that
    // label: it withholds off the post-draft verdict, which is still unreadable.
    // Being out of an edit's reach is not being read.
    const regexRow = report.rules.find((rule) => rule.ruleId === REGEX_FEEDER.id);
    expect(regexRow).toMatchObject({
      transition: 'unchanged-unevaluable',
      beforeReason: 'regex-unsupported-syntax',
      afterReason: 'regex-unsupported-syntax',
    });
    expect(report.counts.undetermined).toBe(0);
  });

  it('MIRROR: without the unevaluable rule, the same fixture loses the group', () => {
    const report = analyze({ rules: [ENG_FEEDER] });

    expect(onlyGroup(report)).toMatchObject({ kind: 'removed' });
    expect(report.counts.removed).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 5. A rule that settles either way still contributes no group effect
// ---------------------------------------------------------------------------

describe('a rule whose verdict the draft does not move contributes no group effect', () => {
  it('settles an absent attribute both sides, so the rule is unchanged', () => {
    // `user.costCenter` is not on the fixture at all, and the draft does not set
    // it. Absence is how Okta reports "no value", so this now settles as a real
    // `no-match` on both sides (ADR-0004) instead of reporting that we could not
    // tell. What this case is actually about is unchanged by that: a rule the
    // draft does not move must not become an addition.
    const costCentreRule = ruleOf({
      id: '0prFAKEcc',
      name: 'Cost centre feeder',
      groupIds: [FINANCE.id],
      conditionExpression: 'user.costCenter=="X"',
      userAttributes: ['costCenter'],
    });

    const report = analyze({ rules: [costCentreRule] });

    expect(report.rules).toHaveLength(1);
    expect(report.rules[0]).toMatchObject({
      transition: 'unchanged-no-match',
      // The draft touches `department`; this rule reads none of the drafted names.
      touchedAttributes: [],
    });
    expect(report.rules[0].beforeReason).toBeUndefined();
    expect(report.rules[0].afterReason).toBeUndefined();
    expect(report.groups).toEqual([]);
    expect(report.counts).toMatchObject({ added: 0, removed: 0, notPredicted: 0 });
  });

  it('still emits no group effect for a rule it genuinely cannot settle', () => {
    // The other half of the original case. `>` declines on strings, so this is
    // unreadable on both sides, and it reads `department`, which the draft sets —
    // so the edit really could have moved it and `undetermined` is the honest
    // answer. An unsettled rule must not become an addition either.
    const unreadableRule = ruleOf({
      id: '0prFAKEre',
      name: 'Threshold feeder',
      groupIds: [FINANCE.id],
      conditionExpression: 'user.department > "A"',
      userAttributes: ['department'],
    });

    const report = analyze({ rules: [unreadableRule] });

    expect(report.rules).toHaveLength(1);
    expect(report.rules[0]).toMatchObject({ transition: 'undetermined' });
    expect(report.groups).toEqual([]);
    expect(report.counts).toMatchObject({ added: 0, removed: 0, notPredicted: 0 });
  });

  it('settles a rule the draft cannot reach, without claiming its verdict', () => {
    // The case this arm exists for: unreadable on both sides, but the condition
    // reads nothing the draft touches. Reported as unaffected rather than as a
    // finding — and never as `unchanged-no-match`, which would assert the user
    // fails a condition nobody managed to read.
    const outOfReach = ruleOf({
      id: '0prFAKEoor',
      name: 'Pattern feeder',
      groupIds: [FINANCE.id],
      conditionExpression: 'isMemberOfGroupNameRegex("(?=Fin).*")',
      userAttributes: [],
    });

    const report = analyze({ rules: [outOfReach] });

    expect(report.rules[0]).toMatchObject({
      transition: 'unchanged-unevaluable',
      // The reason codes stay: we still did not read it, and the row still says so.
      beforeReason: 'regex-unsupported-syntax',
      afterReason: 'regex-unsupported-syntax',
    });
    expect(report.counts.undetermined).toBe(0);
    expect(report.groups).toEqual([]);
  });

  it('keeps an unreadable rule a finding when the draft names an attribute it reads', () => {
    // MIRROR of the above, and the assertion that stops the new arm from swallowing
    // real findings: the same unreadable shape, reachable this time, stays
    // `undetermined`.
    const reachable = ruleOf({
      id: '0prFAKEreach',
      name: 'Reachable feeder',
      groupIds: [FINANCE.id],
      conditionExpression: 'user.department > "A" && isMemberOfGroupNameRegex("(?=Fin).*")',
      userAttributes: ['department'],
    });

    const report = analyze({ rules: [reachable] });

    expect(report.rules[0]).toMatchObject({ transition: 'undetermined' });
    expect(report.counts.undetermined).toBe(1);
  });

  it('treats an unlistable read as reachable, never as out of reach', () => {
    // `user[user.department]` names an attribute that depends on a value, so the
    // read set cannot be enumerated. "We cannot list the reads" must not be read as
    // "there are none" — that is how a real effect would go missing silently.
    const computed = ruleOf({
      id: '0prFAKEcomp',
      name: 'Computed feeder',
      groupIds: [FINANCE.id],
      conditionExpression: 'user[user.department] == "x"',
      userAttributes: [],
    });

    const report = analyze({ rules: [computed] });

    expect(report.rules[0]).toMatchObject({ transition: 'undetermined' });
    expect(report.counts.undetermined).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 6. accessCause wires the shared group context in
// ---------------------------------------------------------------------------

/**
 * Both modules now call the one `groupContext.groupContextOf`, so divergence
 * between two mappers is no longer possible — but *using* the context still is:
 * `classifyAccessCauses` has to actually thread it through to the evaluator, and
 * a regression that dropped it would leave every `isMemberOf*` clause
 * unevaluable. That wiring is what this probe pins.
 *
 * It is established **behaviourally**, because the context never leaves that
 * module: a probe rule whose entire condition is one `isMemberOf*` call is
 * pushed through the real `classifyAccessCauses`, and its remedy reports whether
 * the call resolved.
 *
 * A satisfied call makes the probe rule match the context user, which
 * `classifyAccessCauses` reports as `cannot-determine` (its "every targeting
 * rule accepts them, yet they are not in the group" branch). An unsatisfied one
 * fails the only clause, which is a group clause, so the remedy is
 * `needs-group-membership`. The two are disjoint, which is what makes this a
 * yes/no probe rather than an inference.
 */
const PROBE_GROUP = group('00gFAKEprobe', 'Probe Target');

function accessCauseResolves(memberships: readonly GroupMembership[], expression: string): boolean {
  const probeRule = ruleOf({
    id: '0prFAKEprobe',
    name: 'Probe',
    groupIds: [PROBE_GROUP.id],
    conditionExpression: expression,
  });
  const [cause] = classifyAccessCauses({
    onlyCompared: [membershipOf(PROBE_GROUP, { rules: [probeRule] })],
    contextUser: USER,
    contextGroups: memberships,
    rules: [probeRule],
  });

  if (cause.remedy === 'cannot-determine') return true;
  expect(cause.remedy).toBe('needs-group-membership');
  return false;
}

describe('accessCause resolves against the shared group context', () => {
  const memberships = [ENG_BY_RULE, membershipOf(FINANCE), membershipOf(SALESFORCE, { rules: [] })];

  it('maps memberships to id/name pairs, in order', () => {
    expect(groupContextOf(memberships)).toEqual(
      memberships.map((m) => ({ id: m.group.id, name: m.group.profile.name })),
    );
  });

  it('resolves every id and every name the shared context carries', () => {
    for (const entry of groupContextOf(memberships)) {
      expect(accessCauseResolves(memberships, `isMemberOfGroup("${entry.id}")`)).toBe(true);
      expect(accessCauseResolves(memberships, `isMemberOfGroupName("${entry.name}")`)).toBe(true);
    }
  });

  it('reports what is NOT in the context, or the probe would be vacuous', () => {
    expect(accessCauseResolves(memberships, 'isMemberOfGroup("00gFAKEabsent")')).toBe(false);
    expect(accessCauseResolves(memberships, 'isMemberOfGroupName("Not A Group")')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 7. APP_GROUP
// ---------------------------------------------------------------------------

describe('an app-mastered group is never predicted to be lost', () => {
  it('withholds even for an unhedged, rule-credited membership', () => {
    const appRule = ruleOf({
      id: '0prFAKEsf',
      name: 'Salesforce feeder',
      groupIds: [SALESFORCE.id],
      conditionExpression: 'user.department=="Eng"',
      userAttributes: ['department'],
    });
    const report = analyze({
      rules: [appRule],
      memberships: [membershipOf(SALESFORCE, { rules: [appRule] })],
    });

    expect(onlyGroup(report)).toMatchObject({
      groupId: SALESFORCE.id,
      kind: 'not-predicted',
      withheldReason: 'app-mastered-group',
    });
    expect(report.counts.removed).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 8. INACTIVE rules
// ---------------------------------------------------------------------------

describe('an INACTIVE rule places nobody', () => {
  it('yields neither an addition nor a removal, and says why for each', () => {
    const inactiveFeeder = ruleOf({ ...ENG_FEEDER, status: 'INACTIVE' });
    const inactiveJoiner = ruleOf({
      id: '0prFAKEnew',
      name: 'New hire feeder',
      status: 'INACTIVE',
      groupIds: [NEW_HIRES.id],
      conditionExpression: 'user.department=="Sales"',
      userAttributes: ['department'],
    });

    const report = analyze({ rules: [inactiveFeeder, inactiveJoiner] });

    expect(report.counts).toMatchObject({ added: 0, removed: 0, notPredicted: 2 });
    expect(
      report.groups.map((g) => [g.groupId, g.kind, g.withheldReason, g.currentlyHeld]),
    ).toEqual([
      [ENGINEERING.id, 'not-predicted', 'rule-inactive', true],
      [NEW_HIRES.id, 'not-predicted', 'rule-inactive', false],
    ]);
  });
});

// ---------------------------------------------------------------------------
// 9. Second order, both directions
// ---------------------------------------------------------------------------

describe('second-order cascades are reported, not resolved', () => {
  const newHireFeeder = ruleOf({
    id: '0prFAKEnh',
    name: 'New hire feeder',
    groupIds: [NEW_HIRES.id],
    conditionExpression: 'user.department=="Sales"',
    userAttributes: ['department'],
  });

  const cascadeRule = (expression: string, overrides: Partial<MembershipRule> = {}) =>
    ruleOf({
      id: '0prFAKEcascade',
      name: 'Downstream feeder',
      groupIds: [FINANCE.id],
      conditionExpression: expression,
      ...overrides,
    });

  /** The cascade for one group, as `[ruleId, direction, matchedBy]` triples. */
  const cascadeOf = (report: BlastRadiusReport, groupId: string) =>
    report.cascades
      .find((cascade) => cascade.groupId === groupId)
      ?.rules.map((rule) => [rule.ruleId, rule.direction, rule.matchedBy]);

  it('names the rule whose isMemberOf* reads a group this edit would add', () => {
    const report = analyze({
      rules: [newHireFeeder, cascadeRule('isMemberOfGroupName("New Hires")')],
    });

    expect(report.groups.map((g) => [g.groupId, g.kind])).toEqual([[NEW_HIRES.id, 'added']]);
    expect(report.cascades.map((c) => c.groupId)).toEqual([NEW_HIRES.id]);
    expect(cascadeOf(report, NEW_HIRES.id)).toEqual([['0prFAKEcascade', 'toward-match', 'name']]);
  });

  it('MIRROR: says nothing when the same rule reads an unrelated group', () => {
    const report = analyze({
      rules: [newHireFeeder, cascadeRule('isMemberOfGroupName("Some Other Group")')],
    });

    expect(report.counts.added).toBe(1);
    expect(report.cascades).toEqual([]);
  });

  it('turns away from matching when the clause excludes a group being added', () => {
    const report = analyze({
      rules: [newHireFeeder, cascadeRule(`!isMemberOfAnyGroup("${NEW_HIRES.id}")`)],
    });

    expect(cascadeOf(report, NEW_HIRES.id)).toEqual([['0prFAKEcascade', 'away-from-match', 'id']]);
  });

  it('MIRROR: the same exclusion turns toward matching when the group is removed', () => {
    const report = analyze({
      draft: { department: 'Sales' },
      memberships: [ENG_BY_RULE],
      rules: [ENG_FEEDER, cascadeRule(`!isMemberOfAnyGroup("${ENGINEERING.id}")`)],
    });

    expect(report.groups.map((g) => [g.groupId, g.kind])).toEqual([[ENGINEERING.id, 'removed']]);
    expect(cascadeOf(report, ENGINEERING.id)).toEqual([['0prFAKEcascade', 'toward-match', 'id']]);
  });

  it('turns away from matching when a required group is removed', () => {
    const report = analyze({
      draft: { department: 'Sales' },
      memberships: [ENG_BY_RULE],
      rules: [ENG_FEEDER, cascadeRule(`isMemberOfGroup("${ENGINEERING.id}")`)],
    });

    expect(cascadeOf(report, ENGINEERING.id)).toEqual([
      ['0prFAKEcascade', 'away-from-match', 'id'],
    ]);
  });

  it('reads a group both ways as undetermined, never a coin-flip', () => {
    const report = analyze({
      rules: [
        newHireFeeder,
        cascadeRule('isMemberOfGroupName("New Hires") || !isMemberOfAnyGroupName("New Hires")'),
      ],
    });

    expect(cascadeOf(report, NEW_HIRES.id)).toEqual([['0prFAKEcascade', 'undetermined', 'name']]);
  });

  it('MIRROR: two groups pulled opposite ways each keep their own direction', () => {
    const report = analyze({
      draft: { department: 'Sales' },
      memberships: [ENG_BY_RULE],
      rules: [
        ENG_FEEDER,
        newHireFeeder,
        cascadeRule(`isMemberOfGroupName("New Hires") && isMemberOfGroup("${ENGINEERING.id}")`),
      ],
    });

    expect(cascadeOf(report, NEW_HIRES.id)).toEqual([['0prFAKEcascade', 'toward-match', 'name']]);
    expect(cascadeOf(report, ENGINEERING.id)).toEqual([
      ['0prFAKEcascade', 'away-from-match', 'id'],
    ]);
  });

  it('finds a membership call nested inside a disjunction', () => {
    const report = analyze({
      rules: [
        newHireFeeder,
        cascadeRule('user.title=="Nobody" || isMemberOfGroupName("New Hires")'),
      ],
    });

    expect(cascadeOf(report, NEW_HIRES.id)).toEqual([['0prFAKEcascade', 'toward-match', 'name']]);
  });

  it('MIRROR: an unrelated group in the same nested position is not named', () => {
    const report = analyze({
      rules: [
        newHireFeeder,
        cascadeRule('user.title=="Nobody" || isMemberOfGroupName("Some Other Group")'),
      ],
    });

    expect(report.cascades).toEqual([]);
  });

  it('resolves a runnable tenant regex against the affected group (ADR-0002)', () => {
    const report = analyze({
      rules: [newHireFeeder, cascadeRule('isMemberOfGroupNameRegex("New.*")')],
    });

    expect(cascadeOf(report, NEW_HIRES.id)).toEqual([
      ['0prFAKEcascade', 'toward-match', 'nameRegex'],
    ]);
  });

  it('MIRROR: a pattern the safe engine declines names nothing', () => {
    const report = analyze({
      rules: [newHireFeeder, cascadeRule('isMemberOfGroupNameRegex("(?=New).*")')],
    });

    expect(report.cascades).toEqual([]);
  });

  it('leaves out a rule that is already moving — it has its own row', () => {
    const report = analyze({
      rules: [
        newHireFeeder,
        // Reads New Hires *and* moves on this very draft, so it is reported as a
        // transition rather than twice.
        cascadeRule('isMemberOfGroupName("New Hires") || user.department=="Sales"'),
      ],
    });

    expect(report.rules.find((r) => r.ruleId === '0prFAKEcascade')?.transition).toBe(
      'starts-matching',
    );
    expect(report.cascades).toEqual([]);
  });

  it('MIRROR: the same clause on a rule that is not moving is named', () => {
    const report = analyze({
      rules: [newHireFeeder, cascadeRule('isMemberOfGroupName("New Hires") && user.title=="No"')],
    });

    expect(report.rules.find((r) => r.ruleId === '0prFAKEcascade')?.transition).toBe(
      'unchanged-no-match',
    );
    expect(cascadeOf(report, NEW_HIRES.id)).toEqual([['0prFAKEcascade', 'toward-match', 'name']]);
  });

  it('leaves out an inactive rule — it places nobody', () => {
    const report = analyze({
      rules: [
        newHireFeeder,
        cascadeRule('isMemberOfGroupName("New Hires")', { status: 'INACTIVE' }),
      ],
    });

    expect(report.cascades).toEqual([]);
  });

  it('MIRROR: the byte-identical ACTIVE rule is named', () => {
    const report = analyze({
      rules: [newHireFeeder, cascadeRule('isMemberOfGroupName("New Hires")', { status: 'ACTIVE' })],
    });

    expect(cascadeOf(report, NEW_HIRES.id)).toEqual([['0prFAKEcascade', 'toward-match', 'name']]);
  });

  it('never seeds a cascade from a group it declined to predict', () => {
    // Engineering is held but not credited to any rule, so its removal is
    // withheld — and a change we will not assert cannot have a consequence.
    const report = analyze({
      draft: { department: 'Sales' },
      memberships: [
        membershipOf(ENGINEERING, {
          rules: [ENG_FEEDER],
          provenance: { source: 'okta', rules: [] },
        }),
      ],
      rules: [ENG_FEEDER, cascadeRule(`isMemberOfGroup("${ENGINEERING.id}")`)],
    });

    expect(report.groups.map((g) => g.kind)).toEqual(['not-predicted']);
    expect(report.cascades).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 10. Deterministic ordering
// ---------------------------------------------------------------------------

describe('report order is total and deterministic', () => {
  it('orders groups added → removed → not-predicted, then by name', () => {
    // Two additions with names that sort the opposite way to their rule ids, a
    // removal, and a withheld effect — so kind and name are both exercised.
    const zebraRule = ruleOf({
      id: '0prFAKEaaa',
      name: 'Zebra feeder',
      groupIds: [ZEBRA.id],
      conditionExpression: 'user.department=="Sales"',
    });
    const alphaRule = ruleOf({
      id: '0prFAKEzzz',
      name: 'Alpha feeder',
      groupIds: [ALPHA.id],
      conditionExpression: 'user.department=="Sales"',
    });
    const financeRule = ruleOf({
      id: '0prFAKEfin',
      name: 'Finance feeder',
      status: 'INACTIVE',
      groupIds: [FINANCE.id],
      conditionExpression: 'user.department=="Eng"',
    });

    const report = analyze({
      rules: [zebraRule, alphaRule, ENG_FEEDER, financeRule],
      memberships: [ENG_BY_RULE, membershipOf(FINANCE, { rules: [financeRule] })],
    });

    expect(report.groups.map((g) => [g.kind, g.groupName])).toEqual([
      ['added', 'Alpha Access'],
      ['added', 'Zebra Access'],
      ['removed', 'Engineering'],
      ['not-predicted', 'Finance'],
    ]);
    expect(report.counts).toMatchObject({ added: 2, removed: 1, notPredicted: 1 });
  });

  it('orders rules starts → stops → undetermined → unchanged → out-of-reach', () => {
    const starter = ruleOf({
      id: '0prFAKEstart',
      name: 'Sales feeder',
      groupIds: [NEW_HIRES.id],
      conditionExpression: 'user.department=="Sales"',
    });
    // Unreadable AND reachable: the relational operator declines on strings, and
    // the condition reads `department`, which this draft sets. That combination is
    // what `undetermined` is for, and it is the only thing that earns the rank.
    const unreadable = ruleOf({
      id: '0prFAKEunread',
      name: 'Threshold feeder',
      groupIds: [NEW_HIRES.id],
      conditionExpression: 'user.department > "A"',
    });

    const report = analyze({
      rules: [STAFF_FEEDER, REGEX_FEEDER, ENG_FEEDER, starter, unreadable],
    });

    expect(report.rules.map((r) => [r.transition, r.ruleName])).toEqual([
      ['starts-matching', 'Sales feeder'],
      ['stops-matching', 'Engineering feeder'],
      ['undetermined', 'Threshold feeder'],
      ['unchanged-match', 'Staff feeder'],
      // Last: unreadable, but its condition reads no attribute this draft touches,
      // so the edit cannot move it whatever the verdict is.
      ['unchanged-unevaluable', 'Regex feeder'],
    ]);
    expect(report.counts).toMatchObject({ starts: 1, stops: 1, undetermined: 1 });
  });
});

// ---------------------------------------------------------------------------
// 11. The three inventory states never collapse into two
// ---------------------------------------------------------------------------

describe('the rule inventory state decides the report status', () => {
  it('reports not-computed while the inventory has not resolved', () => {
    const report = analyze({ rules: { status: 'unresolved' } });

    expect(report.status).toBe('not-computed');
    expect(report.groups).toEqual([]);
    expect(report.rules).toEqual([]);
    expect(report.cascades).toEqual([]);
  });

  it('reports unavailable when an attempt completed and failed', () => {
    const report = analyze({ rules: { status: 'unavailable' } });

    expect(report.status).toBe('unavailable');
    expect(report.groups).toEqual([]);
    expect(report.rules).toEqual([]);
  });

  it('keeps the two apart — "not yet" is not "we tried and failed"', () => {
    expect(analyze({ rules: { status: 'unresolved' } }).status).not.toBe(
      analyze({ rules: { status: 'unavailable' } }).status,
    );
  });

  it('accepts the hook`s RuleInventoryState with no adapter', () => {
    // The assignment is the assertion: `FormattedRule[]` satisfies
    // `readonly MembershipRule[]`, so a caller passes `ruleInventory` straight in.
    const fromHook: HookRuleInventoryState = {
      status: 'available',
      rules: [
        {
          id: ENG_FEEDER.id,
          name: ENG_FEEDER.name,
          status: 'ACTIVE',
          condition: 'department=="Eng"',
          conditionExpression: 'user.department=="Eng"',
          groupIds: [ENGINEERING.id],
          userAttributes: ['department'],
          created: '2026-01-01T00:00:00.000Z',
          lastUpdated: '2026-01-01T00:00:00.000Z',
        },
      ],
    };
    const asLocal: RuleInventoryState = fromHook;

    const report = analyze({ rules: asLocal });

    expect(report.status).toBe('computed');
    expect(onlyGroup(report)).toMatchObject({ kind: 'removed' });
  });
});

// ---------------------------------------------------------------------------
// Rule-row detail the UI depends on
// ---------------------------------------------------------------------------

describe('rule rows carry the evidence without carrying prose', () => {
  it('labels the drafted attributes a rule reads and resolves its target names', () => {
    const report = analyze({ rules: [ENG_FEEDER] });

    expect(report.rules[0]).toMatchObject({
      ruleId: ENG_FEEDER.id,
      expression: 'user.department=="Eng"',
      transition: 'stops-matching',
      touchedAttributes: ['department'],
      targetGroupIds: [ENGINEERING.id],
      targetGroupNames: ['Engineering'],
      active: true,
      status: 'ACTIVE',
    });
    expect(report.rules[0].beforeReason).toBeUndefined();
    expect(report.rules[0].afterReason).toBeUndefined();
  });

  it("carries the rule's full status, not just the ACTIVE/not-ACTIVE boolean (D-085)", () => {
    // `active` alone cannot tell a caller whether a non-matching rule was
    // deactivated on purpose or is `INVALID` (unevaluable, typically because a
    // group it names was deleted) — `status` is what lets `BlastRadiusRuleRow`
    // show `Broken` instead of the generic "Not in force" for the second case.
    const invalidFeeder = ruleOf({ ...ENG_FEEDER, status: 'INVALID' });
    const report = analyze({ rules: [invalidFeeder] });

    expect(report.rules[0].active).toBe(false);
    expect(report.rules[0].status).toBe('INVALID');
  });

  it('falls back to the id when no name is cached for a target group', () => {
    const report = analyze({ rules: [ENG_FEEDER], groupNames: new Map() });

    expect(report.rules[0].targetGroupNames).toEqual([ENGINEERING.id]);
  });

  it('never predicts a gain for a group the user already holds', () => {
    // A rule that genuinely STARTS matching, targeting a group the user is
    // already in. You cannot gain what you have, so the addition side emits
    // nothing at all — not a hedged row, not an empty one.
    const alreadyInFeeder = ruleOf({
      id: '0prFAKEdup',
      name: 'Sales feeder',
      groupIds: [ENGINEERING.id],
      conditionExpression: 'user.department=="Sales"',
      userAttributes: ['department'],
    });

    const report = analyze({ rules: [alreadyInFeeder] });

    expect(report.rules[0].transition).toBe('starts-matching');
    expect(report.counts.starts).toBe(1);
    expect(report.groups).toEqual([]);
    expect(report.counts).toMatchObject({ added: 0, removed: 0, notPredicted: 0 });
  });

  it('emits nothing for a rule whose verdict does not move', () => {
    const report = analyze({ rules: [STAFF_FEEDER] });

    expect(report.rules[0].transition).toBe('unchanged-match');
    expect(report.groups).toEqual([]);
  });
});
