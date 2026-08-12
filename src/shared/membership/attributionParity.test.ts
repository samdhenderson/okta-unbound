/**
 * @module shared/membership/attributionParity.test
 * @description **The reconciliation contract between the two attribution paths.**
 *
 * The app answers "how did this user get into this group?" twice, through code
 * that does not share an implementation:
 *
 * - the **group** view — `summarizeMemberSources`, which prefers Okta's own
 *   `_embedded['group-rules']` and only falls back to the heuristic;
 * - the **user** view — `analyzeMemberships` alone, because
 *   `GET /api/v1/users/{id}/groups` carries no attribution embed.
 *
 * Before this test existed, nothing stopped the same person in the same group
 * from being reported one way on one screen and another way on the other. The
 * contract that replaced that silence (ADR-0020) is deliberately not "the two
 * paths always agree" — they cannot, because one of them can consult Okta and
 * the other cannot. It is:
 *
 * > **Where Okta asserted nothing, the two paths agree exactly. Where Okta
 * > asserted something, they may differ, and the difference is fully explained
 * > by that assertion — never by the heuristic drifting.**
 *
 * Both halves are pinned below by running one user and one group through **both
 * real production functions** and comparing the verdicts. The table's
 * `oktaAsserts` flag is what makes the divergence set closed: a scenario Okta
 * says nothing about is *required* to match, so a future edit that makes the two
 * paths drift apart fails here rather than shipping as a screen-dependent answer.
 *
 * Fixtures use obviously fake Okta ids (`00u…`, `00g…`, `0pr…`).
 */

import { describe, it, expect } from 'vitest';
import { summarizeMemberSources, type GroupIdentity } from './groupSource';
import { readEmbeddedGroupRules } from './memberRuleAttribution';
import {
  analyzeMemberships,
  attributionNamesRules,
  isDeducedAttribution,
} from '../utils/membershipAnalysis';
import type { MembershipRule, OktaGroup, OktaUser } from '../types';

const GROUP: GroupIdentity = { id: '00gFAKEeng', name: 'Engineering', type: 'OKTA_GROUP' };

/** The same group, in the shape the user path receives it from Okta. */
const asOktaGroup = (identity: GroupIdentity): OktaGroup => ({
  id: identity.id,
  type: identity.type,
  profile: { name: identity.name },
});

function member(profile: Record<string, string> = {}, embedded?: unknown): OktaUser {
  const base = {
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
  return (embedded === undefined ? base : { ...base, _embedded: embedded }) as OktaUser;
}

/** An evaluable rule: the client can prove match or no-match for itself. */
const evaluableRule: MembershipRule = {
  id: '0prFAKEeval',
  name: 'Eng feeder',
  status: 'ACTIVE',
  groupIds: [GROUP.id],
  conditionExpression: 'user.department=="Eng"',
  userAttributes: ['department'],
};

/**
 * An unevaluable rule: `isMemberOfGroupName` is outside the client-side subset,
 * so the evaluator answers `unevaluable` and the heuristic must guess.
 */
const unevaluableRule = (id: string, name: string): MembershipRule => ({
  id,
  name,
  status: 'ACTIVE',
  groupIds: [GROUP.id],
  conditionExpression: `isMemberOfGroupName("${name}")`,
  userAttributes: [],
});

/**
 * One path's answer about one person in one group, reduced to the three things a
 * screen actually shows: manual vs rule-managed, which rules it is willing to
 * *name*, and whether it is presenting a deduction rather than a fact.
 *
 * Comparing at this level is the point — it is what a user would notice flipping
 * between the two screens, and it is invariant to how either path is structured
 * internally.
 */
interface Verdict {
  managed: 'rule' | 'manual';
  namedRuleIds: string[];
  deduced: boolean;
}

/** The user view's verdict, straight out of the heuristic it runs alone. */
function userViewVerdict(
  identity: GroupIdentity,
  rules: MembershipRule[],
  user: OktaUser,
): Verdict {
  const [membership] = analyzeMemberships([asOktaGroup(identity)], rules, user);
  return {
    managed: membership.membershipType === 'RULE_BASED' ? 'rule' : 'manual',
    // An `ambiguous` membership carries a candidate set, not an answer, so the
    // UI is forbidden from naming its rules — mirror that here.
    namedRuleIds: attributionNamesRules(membership.attribution)
      ? membership.rules.map((rule) => rule.id).sort()
      : [],
    deduced: isDeducedAttribution(membership.attribution),
  };
}

/**
 * The group view's verdict for the *same* person, obtained by summarizing a
 * one-member group. With a single member the aggregate breakdown **is** that
 * member's classification, which is what lets the real production function be
 * compared against the user path without a bespoke per-member shim.
 */
function groupViewVerdict(
  identity: GroupIdentity,
  rules: MembershipRule[],
  user: OktaUser,
): Verdict {
  const breakdown = summarizeMemberSources(identity, [user], rules);
  expect(breakdown.total).toBe(1);
  return {
    managed: breakdown.ruleBased === 1 ? 'rule' : 'manual',
    namedRuleIds: breakdown.byRule.map((contribution) => contribution.ruleId).sort(),
    deduced: breakdown.unattributed === 1,
  };
}

/** One user + group + rule set, and what each path is expected to conclude. */
interface Scenario {
  name: string;
  identity?: GroupIdentity;
  rules: MembershipRule[];
  user: OktaUser;
  /**
   * Whether Okta itself answered for this member (`_embedded['group-rules']`
   * present). `false` makes agreement between the two paths **mandatory**.
   */
  oktaAsserts: boolean;
  /** The group view's expected verdict. */
  groupView: Verdict;
  /**
   * The user view's expected verdict. Identical to {@link groupView} for every
   * `oktaAsserts: false` scenario — stated separately anyway so a drift shows up
   * as a diff of two concrete verdicts rather than as "they stopped matching".
   */
  userView: Verdict;
}

const rule = (managed: 'rule' | 'manual', namedRuleIds: string[], deduced: boolean): Verdict => ({
  managed,
  namedRuleIds,
  deduced,
});

const scenarios: Scenario[] = [
  {
    name: 'no rule targets the group → both call it a manual add',
    rules: [],
    user: member(),
    oktaAsserts: false,
    groupView: rule('manual', [], false),
    userView: rule('manual', [], false),
  },
  {
    name: 'the user provably satisfies the feeding rule → both name that rule',
    rules: [evaluableRule],
    user: member({ department: 'Eng' }),
    oktaAsserts: false,
    groupView: rule('rule', [evaluableRule.id], false),
    userView: rule('rule', [evaluableRule.id], false),
  },
  {
    name: 'the user provably fails the only feeding rule → both call it a manual add',
    rules: [evaluableRule],
    user: member({ department: 'Sales' }),
    oktaAsserts: false,
    groupView: rule('manual', [], false),
    userView: rule('manual', [], false),
  },
  {
    name: 'one unevaluable candidate → both name it, both flag the guess',
    rules: [unevaluableRule('0prFAKEone', 'Contractors')],
    user: member(),
    oktaAsserts: false,
    groupView: rule('rule', ['0prFAKEone'], true),
    userView: rule('rule', ['0prFAKEone'], true),
  },
  {
    name: 'two indistinguishable candidates → neither path names a rule',
    rules: [unevaluableRule('0prFAKEone', 'Contractors'), unevaluableRule('0prFAKEtwo', 'Vendors')],
    user: member(),
    oktaAsserts: false,
    groupView: rule('rule', [], true),
    userView: rule('rule', [], true),
  },
  {
    name: 'APP_GROUP membership is application-managed on both paths',
    identity: { id: '00gFAKEapp', name: 'Salesforce Users', type: 'APP_GROUP' },
    rules: [],
    user: member(),
    oktaAsserts: false,
    groupView: rule('rule', [], false),
    userView: rule('rule', [], false),
  },
  {
    name: 'the user is excluded from the only feeding rule → both call it a manual add',
    rules: [{ ...evaluableRule, conditions: { people: { users: { exclude: ['00uFAKEuser'] } } } }],
    user: member({ department: 'Eng' }),
    oktaAsserts: false,
    groupView: rule('manual', [], false),
    userView: rule('manual', [], false),
  },

  // ---- The sanctioned divergences: Okta answered, and only one path can hear it.
  {
    name: 'DIVERGES: Okta credits a rule the heuristic proved does not match',
    rules: [evaluableRule],
    user: member(
      { department: 'Sales' },
      { 'group-rules': [{ id: '0prFAKEhr', name: 'HR sync' }] },
    ),
    oktaAsserts: true,
    // Okta's own books: this person is fed by a rule the client never evaluated.
    groupView: rule('rule', ['0prFAKEhr'], false),
    // The heuristic, alone, can only see that the one rule it knows says no.
    userView: rule('manual', [], false),
  },
  {
    name: 'DIVERGES: Okta asserts no rule feeds the member; the heuristic was guessing one',
    rules: [unevaluableRule('0prFAKEone', 'Contractors')],
    user: member({}, { 'group-rules': [] }),
    oktaAsserts: true,
    groupView: rule('manual', [], false),
    userView: rule('rule', ['0prFAKEone'], true),
  },
];

describe('attribution parity between the group view and the user view', () => {
  it.each(scenarios)('$name', (scenario) => {
    const identity = scenario.identity ?? GROUP;

    const fromGroupView = groupViewVerdict(identity, scenario.rules, scenario.user);
    const fromUserView = userViewVerdict(identity, scenario.rules, scenario.user);

    expect(fromGroupView).toEqual(scenario.groupView);
    expect(fromUserView).toEqual(scenario.userView);

    // The predicate that licenses a divergence, read from the same function the
    // group path reads it from — so the table cannot claim an exemption Okta did
    // not actually grant.
    const oktaAnswered = readEmbeddedGroupRules(scenario.user).state !== 'unknown';
    expect(oktaAnswered).toBe(scenario.oktaAsserts);

    if (!scenario.oktaAsserts) {
      // THE INVARIANT. Where Okta said nothing, one screen must not contradict
      // the other: same person, same group, same answer.
      expect(fromUserView).toEqual(fromGroupView);
    }
  });

  it('only diverges where Okta itself supplied the answer', () => {
    const diverging = scenarios
      .filter((scenario) => {
        const identity = scenario.identity ?? GROUP;
        const fromGroupView = groupViewVerdict(identity, scenario.rules, scenario.user);
        const fromUserView = userViewVerdict(identity, scenario.rules, scenario.user);
        return JSON.stringify(fromGroupView) !== JSON.stringify(fromUserView);
      })
      .map((scenario) => scenario.name);

    // The divergence set is closed: every entry is an `oktaAsserts` scenario.
    expect(diverging).toEqual(
      scenarios.filter((scenario) => scenario.oktaAsserts).map((scenario) => scenario.name),
    );
  });

  it('never lets the two paths disagree about whether they are guessing, absent an Okta answer', () => {
    // A subtler regression than a flipped verdict: both screens could agree a
    // membership is rule-managed while only one of them admits it is a guess,
    // so one shows "Added by Rule:" and the other "Possible rule:".
    for (const scenario of scenarios.filter((s) => !s.oktaAsserts)) {
      const identity = scenario.identity ?? GROUP;
      expect(groupViewVerdict(identity, scenario.rules, scenario.user).deduced).toBe(
        userViewVerdict(identity, scenario.rules, scenario.user).deduced,
      );
    }
  });
});
