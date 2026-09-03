/**
 * Unit tests for the joins that need the rules payload.
 *
 * Two questions are at stake, and both are easy to get subtly wrong in a way
 * that reads fine on screen:
 *
 * 1. **Filled means assigned, not mentioned.** A group named in a rule's
 *    *condition* is read by that rule, not filled by it. Counting a mention as
 *    a fill would quietly drop the groups most worth finding.
 * 2. **Empty is not the same as unused.** A group with no members can still be
 *    holding an app open, and an `APP_GROUP` is mastered by its app rather than
 *    by any rule. Both are excluded, and both get a case.
 */
import { describe, it, expect } from 'vitest';
import {
  appNamesByGroup,
  dormantAccessCaveat,
  dormantAccessLabel,
  dormantAnchorNote,
  findCleanupCandidates,
  findDormantAccess,
  findRulesWithMissingTargets,
  findUnmaintainedAppAccess,
  groupIdsFilledByRules,
  resolveDormantAnchor,
  APP_SOURCED_NOTE,
  DORMANT_ACCESS_CAVEAT_UNANCHORED,
  DORMANT_ACCESS_DAYS,
  DORMANT_ANCHOR_MAX_AGE_DAYS,
  DORMANT_MAINTAINERS,
  INVISIBLE_MAINTAINERS,
  PUSH_APPS_ONLY,
  type OrphanCandidateGroup,
} from './ruleOrphans';

const group = (over: Partial<OrphanCandidateGroup> & { id: string }): OrphanCandidateGroup => ({
  name: over.id,
  memberCount: 0,
  type: 'OKTA_GROUP',
  ...over,
});

describe('groupIdsFilledByRules', () => {
  it('collects every group any rule assigns to', () => {
    const filled = groupIdsFilledByRules([
      { groupIds: ['00gFAKE1', '00gFAKE2'] },
      { groupIds: ['00gFAKE2'] },
      { groupIds: [] },
    ]);
    expect([...filled].sort()).toEqual(['00gFAKE1', '00gFAKE2']);
  });
});

describe('appNamesByGroup', () => {
  it('recovers the app from the compound record id, not from the entity', () => {
    // Okta returns the assigned *group's* id as the assignment's own id, so the
    // app exists only in the snapshot's key. Reading the entity here would
    // attribute every assignment to the wrong side of the pair.
    const byGroup = appNamesByGroup(
      ['0oaFAKE1::00gFAKE1', '0oaFAKE2::00gFAKE1', '0oaFAKE1::00gFAKE2'],
      new Map([
        ['0oaFAKE1', 'Slack'],
        ['0oaFAKE2', 'Workday'],
      ]),
    );
    expect(byGroup.get('00gFAKE1')).toEqual(['Slack', 'Workday']);
    expect(byGroup.get('00gFAKE2')).toEqual(['Slack']);
  });

  it('falls back to the app id rather than dropping an unnamed app', () => {
    // The finding is about the group. A label the inventory has not supplied is
    // not a reason to under-report the apps it is holding open.
    const byGroup = appNamesByGroup(['0oaFAKE9::00gFAKE1'], new Map());
    expect(byGroup.get('00gFAKE1')).toEqual(['0oaFAKE9']);
  });

  it('ignores a record id with no shard key', () => {
    expect(appNamesByGroup(['00gFAKE1'], new Map()).size).toBe(0);
  });
});

describe('findCleanupCandidates', () => {
  const groups = [
    group({ id: '00gFAKE1', name: 'Abandoned' }),
    group({ id: '00gFAKE2', name: 'Filled by a rule' }),
    group({ id: '00gFAKE3', name: 'Has members', memberCount: 4 }),
    group({ id: '00gFAKE4', name: 'Holds an app open' }),
    group({ id: '00gFAKE5', name: 'Sourced from an app', type: 'APP_GROUP' }),
    group({ id: '00gFAKE6', name: 'Everyone', type: 'BUILT_IN' }),
  ];

  it('finds only the groups that are empty, unfilled and unassigned', () => {
    const found = findCleanupCandidates(groups, new Set(['00gFAKE2']), new Set(['00gFAKE4']));
    expect(found.map((finding) => finding.id)).toEqual(['00gFAKE1']);
    expect(found[0].detail).toBe('No members · no rule fills it · no app assigned');
  });

  it('keeps an empty group that is holding app access open', () => {
    // Deleting it would revoke the access it is holding, so it is not a cleanup
    // candidate however empty it looks.
    const found = findCleanupCandidates(groups, new Set(), new Set(['00gFAKE1', '00gFAKE4']));
    expect(found.map((finding) => finding.id)).not.toContain('00gFAKE4');
    expect(found.map((finding) => finding.id)).not.toContain('00gFAKE1');
  });

  it('leaves app-sourced and built-in groups alone', () => {
    const found = findCleanupCandidates(groups, new Set(), new Set());
    expect(found.map((finding) => finding.id)).toEqual(['00gFAKE1', '00gFAKE2', '00gFAKE4']);
  });

  it('orders by name, so the same org lists the same way twice running', () => {
    const found = findCleanupCandidates(
      [group({ id: 'b', name: 'Zulu' }), group({ id: 'a', name: 'Alpha' })],
      new Set(),
      new Set(),
    );
    expect(found.map((finding) => finding.name)).toEqual(['Alpha', 'Zulu']);
  });
});

describe('findUnmaintainedAppAccess', () => {
  const groups = [
    group({ id: '00gFAKE1', name: 'Sales tools', memberCount: 12 }),
    group({ id: '00gFAKE2', name: 'Engineering tools', memberCount: 40 }),
    group({ id: '00gFAKE3', name: 'Ruled', memberCount: 7 }),
    group({ id: '00gFAKE4', name: 'Empty but assigned', memberCount: 0 }),
    group({ id: '00gFAKE5', name: 'No app', memberCount: 9 }),
  ];
  const byGroup = new Map([
    ['00gFAKE1', ['Slack']],
    ['00gFAKE2', ['Slack', 'Workday']],
    ['00gFAKE3', ['Slack']],
    ['00gFAKE4', ['Slack']],
  ]);

  it('lists the unmanaged access, biggest blast radius first', () => {
    const found = findUnmaintainedAppAccess(groups, new Set(['00gFAKE3']), byGroup);
    expect(found.map((finding) => finding.id)).toEqual(['00gFAKE2', '00gFAKE1']);
    expect(found[0].detail).toBe('40 members · Slack, Workday');
  });

  it('leaves the empty ones to the cleanup report', () => {
    // Listing a group nobody is in as "access nothing maintains" would put a
    // finding with no consequence at the top of a list sorted by consequence.
    const found = findUnmaintainedAppAccess(groups, new Set(), byGroup);
    expect(found.map((finding) => finding.id)).not.toContain('00gFAKE4');
  });

  it('says "member" for one', () => {
    const found = findUnmaintainedAppAccess(
      [group({ id: '00gFAKE1', name: 'Solo', memberCount: 1 })],
      new Set(),
      new Map([['00gFAKE1', ['Slack']]]),
    );
    expect(found[0].detail).toBe('1 member · Slack');
  });

  it('carries no member count into the finding it returns', () => {
    // The sort key is an implementation detail of this function. Leaking it
    // would put a field on the finding type that only one of the two producers
    // sets, and the row would start branching on its presence.
    const [found] = findUnmaintainedAppAccess(
      [group({ id: '00gFAKE1', name: 'Solo', memberCount: 1 })],
      new Set(),
      new Map([['00gFAKE1', ['Slack']]]),
    );
    expect(Object.keys(found).sort()).toEqual(['detail', 'id', 'name']);
  });
});

describe('findRulesWithMissingTargets', () => {
  const rule = { id: '0prFAKE1', name: 'Contractor intake', groupIds: ['00gFAKE1', '00gFAKE2'] };

  it('says nothing when every target still exists', () => {
    const found = findRulesWithMissingTargets([rule], new Set(['00gFAKE1', '00gFAKE2']), true);
    expect(found).toEqual([]);
  });

  it('names only the targets with no group behind them', () => {
    const found = findRulesWithMissingTargets([rule], new Set(['00gFAKE1']), true);
    expect(found).toEqual([
      { id: '0prFAKE1', name: 'Contractor intake', missingGroupIds: ['00gFAKE2'] },
    ]);
  });

  it('suppresses the finding entirely when the group walk did not finish', () => {
    // The gate, and the reason this join is not a one-liner: the group
    // collection is read *negatively*, so against a half-read inventory every
    // rule in the org looks broken. Silence is the only honest answer — not a
    // hedged wording, and not the subset that happened to be on disk.
    const found = findRulesWithMissingTargets([rule], new Set(['00gFAKE1']), false);
    expect(found).toEqual([]);
  });

  it('reports a rule whose every target is gone, and keeps the rule order', () => {
    const second = { id: '0prFAKE2', name: 'Alpha rule', groupIds: ['00gFAKE9'] };
    const found = findRulesWithMissingTargets([rule, second], new Set(), true);
    expect(found.map((f) => f.id)).toEqual(['0prFAKE1', '0prFAKE2']);
    expect(found[0].missingGroupIds).toEqual(['00gFAKE1', '00gFAKE2']);
  });

  it('is silent about a rule that assigns to nothing at all', () => {
    // "Assigns nowhere" is a different finding with its own copy on the rule
    // rung. Reporting it here would put two unrelated defects behind one badge.
    const found = findRulesWithMissingTargets(
      [{ id: '0prFAKE3', name: 'Inert', groupIds: [] }],
      new Set(),
      true,
    );
    expect(found).toEqual([]);
  });
});

/**
 * The dormant join makes the strongest claim on the Home tab — *nothing wrote
 * to this group* rather than *we see nothing filling it* — so ADR-0067's three
 * bounds are each pinned here: the clock is the anchor and never `now`, the
 * threshold is this report's own, and an `APP_GROUP` is labelled rather than
 * dropped.
 */
describe('findDormantAccess', () => {
  const DAY = 24 * 60 * 60 * 1000;
  // Deliberately long past. Every date below is written relative to it, so a
  // join that reached for `Date.now()` instead would compute a different age on
  // every row and this suite would say so.
  const ANCHOR = Date.UTC(2020, 0, 1);
  const daysBefore = (days: number) => new Date(ANCHOR - days * DAY).toISOString();

  const apps = new Map([
    ['00gFAKE1', ['Salesforce', 'Jira']],
    ['00gFAKE2', ['Salesforce']],
  ]);

  const member = (over: Partial<OrphanCandidateGroup> & { id: string }): OrphanCandidateGroup =>
    group({ memberCount: 12, ...over });

  it('names a group whose membership has been silent since before the anchor', () => {
    const found = findDormantAccess(
      [member({ id: '00gFAKE1', name: 'Sales tools', lastMembershipUpdated: daysBefore(730) })],
      new Set(),
      apps,
      ANCHOR,
    );
    expect(found).toEqual([
      {
        id: '00gFAKE1',
        name: 'Sales tools',
        detail: '12 members · Salesforce, Jira · no membership change in 2 years',
      },
    ]);
  });

  it('labels an app-sourced row rather than dropping it', () => {
    // ADR-0067 §2: an app group granting access from a dead source directory is
    // one of the more serious findings here, and excluding it would narrow this
    // population relative to the report it sits beside.
    const found = findDormantAccess(
      [
        member({
          id: '00gFAKE2',
          name: 'SFDC Users',
          type: 'APP_GROUP',
          lastMembershipUpdated: daysBefore(400),
        }),
      ],
      new Set(),
      apps,
      ANCHOR,
    );
    expect(found[0].detail).toBe(
      '12 members · Salesforce · no membership change in 1 year · app-sourced',
    );
  });

  it('takes the threshold at exactly DORMANT_ACCESS_DAYS and not a day sooner', () => {
    const at = (days: number) =>
      findDormantAccess(
        [member({ id: '00gFAKE1', lastMembershipUpdated: daysBefore(days) })],
        new Set(),
        apps,
        ANCHOR,
      );
    expect(at(DORMANT_ACCESS_DAYS)).toHaveLength(1);
    expect(at(DORMANT_ACCESS_DAYS)[0].detail).toContain('no membership change in 6 months');
    expect(at(DORMANT_ACCESS_DAYS - 1)).toEqual([]);
  });

  it('measures from the anchor, never from now', () => {
    // The whole of ADR-0067 §3 in one case: a group silent for a decade in real
    // time, read against an anchor taken a week after its last write, is not a
    // finding. A `Date.now()` clock would report it as dormant with confidence.
    const found = findDormantAccess(
      [member({ id: '00gFAKE1', lastMembershipUpdated: daysBefore(7) })],
      new Set(),
      apps,
      ANCHOR,
    );
    expect(found).toEqual([]);
  });

  it('treats a missing or unparseable date as no evidence, not as silence', () => {
    const found = findDormantAccess(
      [
        member({ id: '00gFAKE1' }),
        member({ id: '00gFAKE2', lastMembershipUpdated: 'whenever Okta feels like it' }),
      ],
      new Set(),
      apps,
      ANCHOR,
    );
    expect(found).toEqual([]);
  });

  it('keeps the population of its sibling: members, no rule, and an app', () => {
    const rows = [
      member({ id: '00gFAKE1', lastMembershipUpdated: daysBefore(730) }),
      member({ id: '00gFAKE2', lastMembershipUpdated: daysBefore(730) }),
      member({ id: '00gFAKE3', memberCount: 0, lastMembershipUpdated: daysBefore(730) }),
      member({ id: '00gFAKE4', lastMembershipUpdated: daysBefore(730) }),
    ];
    // `00gFAKE2` is filled by a rule, `00gFAKE3` is empty, `00gFAKE4` carries no
    // app access at all.
    const found = findDormantAccess(rows, new Set(['00gFAKE2']), apps, ANCHOR);
    expect(found.map((finding) => finding.id)).toEqual(['00gFAKE1']);
  });

  it('leads with the longest silence, then the widest reach, then the name', () => {
    const rows = [
      member({ id: '00gFAKE1', name: 'Zed', lastMembershipUpdated: daysBefore(200) }),
      member({ id: '00gFAKE2', name: 'Alpha', lastMembershipUpdated: daysBefore(900) }),
    ];
    const found = findDormantAccess(rows, new Set(), apps, ANCHOR);
    expect(found.map((finding) => finding.name)).toEqual(['Alpha', 'Zed']);
  });
});

describe('resolveDormantAnchor', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const NOW = Date.UTC(2026, 8, 1);

  it('uses a walk that finished inside the window', () => {
    expect(resolveDormantAnchor(NOW - 5 * DAY, NOW)).toEqual({ usable: true, at: NOW - 5 * DAY });
  });

  it('refuses a collection that has never been fully walked', () => {
    // Not a softer claim, a withheld one: with no complete walk behind it every
    // stored membership date could be frozen at any age (`D-076`).
    expect(resolveDormantAnchor(null, NOW)).toEqual({
      usable: false,
      at: null,
      reason: 'never-walked',
    });
  });

  it('refuses a walk older than the window, and keeps its date for the copy', () => {
    const at = NOW - (DORMANT_ANCHOR_MAX_AGE_DAYS + 1) * DAY;
    expect(resolveDormantAnchor(at, NOW)).toEqual({ usable: false, at, reason: 'stale' });
  });

  it('takes the boundary itself as usable', () => {
    const at = NOW - DORMANT_ANCHOR_MAX_AGE_DAYS * DAY;
    expect(resolveDormantAnchor(at, NOW)).toEqual({ usable: true, at });
  });
});

describe('the dormant report’s copy', () => {
  it('states its own threshold in the label, derived from the constant', () => {
    expect(dormantAccessLabel()).toBe('App access with no membership change in 6 months');
    expect(DORMANT_ACCESS_DAYS).toBe(180);
  });

  it('narrows INVISIBLE_MAINTAINERS instead of repeating it', () => {
    // ADR-0067 §1's rejected-wordings table: pasting the sibling caveat in would
    // say "anything could be filling this invisibly" under a finding that
    // specifically rules that out.
    const caveat = dormantAccessCaveat('Aug 1, 2026');
    expect(caveat).not.toContain(INVISIBLE_MAINTAINERS);
    expect(caveat).toContain(DORMANT_MAINTAINERS);
    expect(caveat).toContain(APP_SOURCED_NOTE);
    expect(caveat).toContain(PUSH_APPS_ONLY);
  });

  it('names the clock it is anchored to', () => {
    expect(dormantAccessCaveat('Aug 1, 2026')).toContain(
      'Measured from the last complete read of your groups, Aug 1, 2026 — not from today.',
    );
  });

  it('never uses a wording the ADR rejected', () => {
    const copy = [
      dormantAccessCaveat('Aug 1, 2026'),
      dormantAccessLabel(),
      DORMANT_ACCESS_CAVEAT_UNANCHORED,
      dormantAnchorNote('never-walked', 'Aug 1, 2026'),
      dormantAnchorNote('stale', 'Aug 1, 2026'),
    ].join(' ');
    for (const banned of ['abandoned', 'orphaned', 'unused', 'touched', 'safe to revoke']) {
      expect(copy.toLowerCase()).not.toContain(banned);
    }
  });

  it('points at the read that is missing, and says how old the stale one is', () => {
    expect(dormantAnchorNote('never-walked', 'Aug 1, 2026')).toBe(
      'Needs a complete read of your groups, which has not finished yet.',
    );
    expect(dormantAnchorNote('stale', 'Aug 1, 2026')).toBe(
      'Needs a complete read of your groups from the last 30 days. The last one finished Aug 1, 2026.',
    );
  });
});
