/**
 * The remedy must be one that would actually reproduce the access.
 *
 * The classifier used to ask only "does a rule target this group, and does the
 * context user fail it?". That produced **"fix a profile attribute"** for a group
 * the compared user had simply been added to by hand — sending an admin to change
 * a profile value to satisfy a rule that granted nobody anything. Provenance is
 * now consulted first, and these pin the three answers that follow from it.
 *
 * Also covers the `isMemberOf*` clauses that used to be reported as "needs
 * investigation": with the context user's group list in hand they resolve, and the
 * groups the rule asks for are named so the row can offer to grant one.
 */
import { describe, it, expect } from 'vitest';
import { classifyAccessCauses, type AccessCause } from './accessCause';
import type {
  GroupMembership,
  MembershipRule,
  OktaGroup,
  OktaUser,
} from '../../../../shared/types';

const GROUP_ID = '00gFAKEGROUP01';
const PREREQ_ID = '00gFAKEPREREQ1';

const contextUser: OktaUser = {
  id: '00uFAKECONTEXT',
  status: 'ACTIVE',
  profile: {
    login: 'context@example.com',
    email: 'context@example.com',
    firstName: 'Con',
    lastName: 'Text',
    department: 'Engineering',
  },
};

const group = (id = GROUP_ID, name = 'VPN Access', type: OktaGroup['type'] = 'OKTA_GROUP') => ({
  id,
  type,
  profile: { name },
});

const membership = (over: Partial<GroupMembership> = {}): GroupMembership => ({
  group: group(),
  membershipType: 'RULE_BASED',
  rules: [],
  attribution: 'exact',
  ...over,
});

/** A rule that targets the group and that the context user FAILS on department. */
const salesRule: MembershipRule = {
  id: '0prFAKE0001',
  name: 'Sales rule',
  status: 'ACTIVE',
  groupIds: [GROUP_ID],
  conditionExpression: 'user.department == "Sales"',
};

const classify = (
  memberships: GroupMembership[],
  rules: MembershipRule[],
  contextGroups?: GroupMembership[],
): AccessCause =>
  classifyAccessCauses({ onlyCompared: memberships, contextUser, rules, contextGroups })[0];

describe('the remedy follows the provenance', () => {
  it('THE BUG: a hand-added group is manual-add even though a rule targets it and the user fails it', () => {
    // The rule really would grant the group, and the context user really does
    // fail its department clause — but that is not how the compared user got it.
    // Telling an admin to change a profile value here acts on a rule nobody used.
    const cause = classify(
      [membership({ membershipType: 'DIRECT', attribution: 'exact' })],
      [salesRule],
    );

    expect(cause.remedy).toBe('manual-add');
    expect(cause.failingClauses).toEqual([]);
  });

  it('still reports blocked-by-attribute when a rule IS what grants it', () => {
    const cause = classify([membership()], [salesRule]);

    expect(cause.remedy).toBe('blocked-by-attribute');
    expect(cause.failingClauses).toHaveLength(1);
  });

  it('reports an app-mastered group as app-managed, never as an attribute to fix', () => {
    // An app owns this roster: no profile edit and no manual add reproduces it.
    const cause = classify(
      [membership({ group: group(GROUP_ID, 'Okta Admins', 'APP_GROUP') })],
      [salesRule],
    );

    expect(cause.remedy).toBe('app-managed');
    expect(cause.failingClauses).toEqual([]);
  });

  it('says app-managed even with no rule inventory — the group type alone settles it', () => {
    const cause = classifyAccessCauses({
      onlyCompared: [membership({ group: group(GROUP_ID, 'Okta Admins', 'APP_GROUP') })],
      contextUser,
      rules: null,
    })[0];

    expect(cause.remedy).toBe('app-managed');
  });
});

describe('group-membership clauses are answered, not shrugged at', () => {
  const prereqRule: MembershipRule = {
    id: '0prFAKEPRQ',
    name: 'VPN prerequisite',
    status: 'ACTIVE',
    groupIds: [GROUP_ID],
    conditionExpression: `isMemberOfGroup("${PREREQ_ID}")`,
  };

  const inGroup = (id: string, name: string): GroupMembership =>
    membership({ group: group(id, name) });

  it('names the prerequisite group instead of reporting needs-investigation', () => {
    // Without a group list this was `cannot-determine` / `needs-group-context`.
    const cause = classify([membership()], [prereqRule], [inGroup('00gFAKEOTHER', 'Everyone')]);

    expect(cause.remedy).toBe('needs-group-membership');
    expect(cause.requiredGroups).toEqual([{ match: 'id', value: PREREQ_ID, satisfied: false }]);
  });

  it('lists every candidate of an isMemberOfAnyGroup, all unsatisfied', () => {
    const anyRule: MembershipRule = {
      ...prereqRule,
      conditionExpression: `isMemberOfAnyGroup("${PREREQ_ID}", "00gFAKEPREREQ2")`,
    };
    const cause = classify([membership()], [anyRule], [inGroup('00gFAKEOTHER', 'Everyone')]);

    expect(cause.remedy).toBe('needs-group-membership');
    // The whole set, because the rule wanted any ONE of them and got none.
    expect(cause.requiredGroups?.map((r) => r.value)).toEqual([PREREQ_ID, '00gFAKEPREREQ2']);
    expect(cause.requiredGroups?.every((r) => !r.satisfied)).toBe(true);
  });

  it('keeps the attribute remedy when a profile clause fails alongside a group clause', () => {
    // Joining the group alone would not qualify them — the department is wrong
    // too — so the heading must stay the profile fix, with the group listed.
    const bothRule: MembershipRule = {
      ...prereqRule,
      conditionExpression: `user.department == "Sales" && isMemberOfGroup("${PREREQ_ID}")`,
    };
    const cause = classify([membership()], [bothRule], [inGroup('00gFAKEOTHER', 'Everyone')]);

    expect(cause.remedy).toBe('blocked-by-attribute');
    expect(cause.requiredGroups?.map((r) => r.value)).toEqual([PREREQ_ID]);
  });

  it('falls back to cannot-determine when no group list was supplied', () => {
    // The honest answer when we genuinely cannot evaluate the clause.
    const cause = classify([membership()], [prereqRule]);

    expect(cause.remedy).toBe('cannot-determine');
    expect(cause.undeterminedReason).toBe('needs-group-context');
  });

  it('resolves a satisfied prerequisite rather than blaming it', () => {
    // The user IS in the prerequisite group, so the rule matches and there is no
    // attribute to fix — the contradictory case, reported as undetermined.
    const cause = classify([membership()], [prereqRule], [inGroup(PREREQ_ID, 'VPN Prerequisite')]);

    expect(cause.remedy).toBe('cannot-determine');
    expect(cause.requiredGroups ?? []).toEqual([]);
  });
});
