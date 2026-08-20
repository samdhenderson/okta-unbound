/**
 * @module sidepanel/components/users/appSourceSummary.test
 * @description Pins the Apps pane's derivation: the three badge states, the row
 * that must state two facts at once, the summary's accounting, and the wording
 * this module borrows rather than owns.
 *
 * The last of those is the reason there is a React import in a test for a pure
 * module. `AppScopeIndicator` owns the four assignment states and their caveat
 * prose; `appSourceSummary` re-states three of them because it cannot import a
 * module-private table out of a comparison-view component. A copy that nothing
 * checks is how two surfaces end up describing the same fact two ways, so the
 * check is here: render the real indicator, read the words it actually shows, and
 * compare. If the prose is improved over there, this fails rather than the panel
 * quietly disagreeing with itself.
 */
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import AppScopeIndicator from './comparison/AppScopeIndicator';
import {
  APP_SOURCE_COPY,
  appSourceSummaryLine,
  indexAppsByGroup,
  isPrivilegedApp,
  summarizeAppSources,
  type AppSourceState,
} from './appSourceSummary';
import type { GroupMembership } from '../../../shared/types';
import type { UserAppAssignment } from '../../hooks/useOktaApi/userOperations';

const APP_ID = '0oaFAKEapp000001';
const GROUP_ID = '00gFAKE00000000000001';

const app = (over: Partial<UserAppAssignment> = {}): UserAppAssignment => ({
  id: APP_ID,
  label: 'Salesforce',
  ...over,
});

const membership = (over: Partial<GroupMembership> = {}): GroupMembership => ({
  group: { id: GROUP_ID, type: 'OKTA_GROUP', profile: { name: 'sales.emea' } },
  membershipType: 'RULE_BASED',
  rules: [
    {
      id: '0prFAKErule00001',
      name: 'EMEA sales',
      status: 'ACTIVE',
      conditionExpression: 'user.department == "Sales"',
      groupIds: [GROUP_ID],
      userAttributes: ['department'],
    },
  ],
  attribution: 'exact',
  ...over,
});

/** The one row `summarizeAppSources` produces for a single assignment. */
const row = (assignment: UserAppAssignment, memberships: GroupMembership[] = []) =>
  summarizeAppSources([assignment], memberships).rows[0];

describe('appSourceSummary — badge states', () => {
  it("labels a reported 'USER' scope Direct", () => {
    const r = row(app({ scope: 'USER' }));
    expect(r.badgeLabel).toBe('Direct');
    expect(r.badgeVariant).toBe('success');
    expect(r.bucket).toBe('direct');
  });

  it("labels a reported 'GROUP' scope Via group", () => {
    const r = row(app({ scope: 'GROUP' }));
    expect(r.badgeLabel).toBe('Via group');
    expect(r.badgeVariant).toBe('primary');
    expect(r.bucket).toBe('viaGroup');
  });

  it('labels an absent scope Source unknown, never as a group grant', () => {
    const r = row(app({ scope: undefined }));
    expect(r.badgeLabel).toBe('Source unknown');
    expect(r.badgeVariant).toBe('warning');
    expect(r.bucket).toBe('unknown');
    expect(r.sourceLine).not.toMatch(/^Through /);
  });
});

describe('appSourceSummary — the source line', () => {
  it("names the group once it is known: 'Through {group}'", () => {
    const r = row(app({ scope: 'GROUP', grantGroupId: GROUP_ID }), [membership()]);
    expect(r.sourceLine).toBe('Through sales.emea');
    expect(r.sourceKnown).toBe(true);
    expect(r.grantGroupName).toBe('sales.emea');
  });

  it("states BOTH facts on a 'USER'-scope row that also names a group", () => {
    // The case the old model could not express. Okta reports one scope per
    // app-user and prefers USER, so a direct assignment does not rule out a group
    // path — and here Okta named that group in the same response. The badge and
    // the line are two true statements, not a contradiction to be resolved.
    const r = row(app({ scope: 'USER', grantGroupId: GROUP_ID }), [membership()]);

    expect(r.badgeLabel).toBe('Direct');
    expect(r.sourceLine).toBe('Through sales.emea');
    expect(r.sourceKnown).toBe(true);
    // And the caveat still refuses exclusivity, so nothing here reads as
    // "direct only".
    expect(r.caveat).toMatch(/does not rule out a group path/i);
  });

  it('falls back to the honest non-answer when no group is named', () => {
    const r = row(app({ scope: 'GROUP' }));
    expect(r.sourceKnown).toBe(false);
    expect(r.sourceLine).toBe(APP_SOURCE_COPY.GROUP.caveat);
  });

  it('treats an undefined grantGroupId as unknown, never as "no group path"', () => {
    const r = row(app({ scope: 'GROUP' }), [membership()]);
    expect(r.grantGroupId).toBeUndefined();
    expect(r.grantGroupName).toBeUndefined();
    // The caveat may *mention* a direct assignment to contrast with it; what it
    // must never do is assert one, or assert that no group path exists.
    expect(r.sourceLine).not.toMatch(/no group/i);
    expect(r.sourceLine).not.toMatch(/(assigned|added) directly/i);
    expect(r.sourceLine).toBe(APP_SOURCE_COPY.GROUP.caveat);
  });

  it('keeps a named group whose membership is not in hand, using its id', () => {
    // Okta credited a group; we simply cannot spell its name. Dropping the source
    // because the display name is missing would turn a known answer back into
    // "unknown".
    const r = row(app({ scope: 'GROUP', grantGroupId: GROUP_ID }), []);
    expect(r.sourceKnown).toBe(true);
    expect(r.grantGroupName).toBe(GROUP_ID);
    expect(r.grantGroupSourceLine).toBeUndefined();
  });

  it("explains the granting group's own source from the membership", () => {
    const r = row(app({ scope: 'GROUP', grantGroupId: GROUP_ID }), [membership()]);
    expect(r.grantGroupSourceLine).toBe('Added by Rule: EMEA sales');
  });

  it('reports an app-mastered granting group as app-managed rather than as a rule', () => {
    const r = row(app({ scope: 'GROUP', grantGroupId: GROUP_ID }), [
      membership({
        group: { id: GROUP_ID, type: 'APP_GROUP', profile: { name: 'workday.sales' } },
        rules: [],
      }),
    ]);
    expect(r.grantGroupSourceLine).toBe('Managed by app');
  });
});

describe('appSourceSummary — the summary line', () => {
  it('omits a zero bucket', () => {
    expect(appSourceSummaryLine({ direct: 2, viaGroup: 0, unknown: 0 })).toBe('2 direct');
  });

  it('never drops a non-zero bucket', () => {
    expect(appSourceSummaryLine({ direct: 1, viaGroup: 4, unknown: 2 })).toBe(
      '1 direct · 4 via group · 2 unknown source',
    );
  });

  it('keeps a lone unknown bucket, so a pane of non-answers still says so', () => {
    expect(appSourceSummaryLine({ direct: 0, viaGroup: 0, unknown: 3 })).toBe('3 unknown source');
  });

  it('is empty when there are no apps at all', () => {
    expect(summarizeAppSources([], []).summary).toBe('');
  });

  it('counts every row into exactly one bucket', () => {
    const { counts, rows } = summarizeAppSources(
      [
        app({ id: '0oaFAKEapp000001', scope: 'USER' }),
        app({ id: '0oaFAKEapp000002', scope: 'GROUP' }),
        app({ id: '0oaFAKEapp000003', scope: 'GROUP' }),
        app({ id: '0oaFAKEapp000004' }),
      ],
      [],
    );
    expect(counts).toEqual({ direct: 1, viaGroup: 2, unknown: 1 });
    expect(counts.direct + counts.viaGroup + counts.unknown).toBe(rows.length);
  });
});

describe('appSourceSummary — privileged apps', () => {
  it('marks the admin console, case- and whitespace-insensitively', () => {
    expect(isPrivilegedApp('Okta Admin Console')).toBe(true);
    expect(isPrivilegedApp('  okta admin console ')).toBe(true);
    expect(row(app({ label: 'Okta Admin Console' })).isPrivileged).toBe(true);
  });

  it('does not mark an app that merely contains "admin"', () => {
    // A substring heuristic would badge the handbook and miss a renamed console.
    // A false "Privileged" manufactures a finding about someone's access.
    expect(isPrivilegedApp('Admin Handbook')).toBe(false);
    expect(isPrivilegedApp('Salesforce')).toBe(false);
  });
});

describe('appSourceSummary — the inverse index', () => {
  it('lists the apps a group grants, keyed by that group', () => {
    const { rows } = summarizeAppSources(
      [
        app({
          id: '0oaFAKEapp000001',
          label: 'Salesforce',
          scope: 'GROUP',
          grantGroupId: GROUP_ID,
        }),
        app({ id: '0oaFAKEapp000002', label: 'Figma', scope: 'USER', grantGroupId: GROUP_ID }),
      ],
      [membership()],
    );
    expect(indexAppsByGroup(rows)).toEqual({ [GROUP_ID]: ['Salesforce', 'Figma'] });
  });

  it('files nothing under a guess when the granting group is unknown', () => {
    const { rows } = summarizeAppSources([app({ scope: 'GROUP' })], [membership()]);
    expect(indexAppsByGroup(rows)).toEqual({});
  });
});

describe('appSourceSummary — the filter haystack', () => {
  it('matches on the app label and on the granting group name', () => {
    const r = row(app({ scope: 'GROUP', grantGroupId: GROUP_ID }), [membership()]);
    expect(r.filterText).toContain('salesforce');
    expect(r.filterText).toContain('sales.emea');
  });
});

describe('appSourceSummary — borrowed wording does not drift', () => {
  /** The words the real indicator shows for a state: its visible label and its `title`. */
  const indicator = (state: AppSourceState) => {
    const { container } = render(React.createElement(AppScopeIndicator, { state }));
    const el = container.firstElementChild;
    if (!(el instanceof HTMLElement)) throw new Error(`nothing rendered for state "${state}"`);
    return { label: el.textContent ?? '', caveat: el.title };
  };

  it.each(['USER', 'GROUP', 'unknown'] as const)(
    'uses AppScopeIndicator\'s own label and caveat for "%s"',
    (state) => {
      const real = indicator(state);
      expect(APP_SOURCE_COPY[state].label).toBe(real.label);
      expect(APP_SOURCE_COPY[state].caveat).toBe(real.caveat);
    },
  );

  it('never claims exclusivity in any state it renders', () => {
    // The same guard AppScopeIndicator's own suite applies, re-applied to the
    // strings this pane actually shows — a row here carries the caveat as its
    // whole second line, so a regression would be louder, not quieter.
    for (const state of ['USER', 'GROUP', 'unknown'] as const) {
      const text = `${APP_SOURCE_COPY[state].label} ${APP_SOURCE_COPY[state].caveat}`;
      expect(text).not.toMatch(/direct only/i);
      expect(text).not.toMatch(/only direct/i);
      expect(text).not.toMatch(/not via (a )?group/i);
      expect(text).not.toMatch(/no group/i);
    }
  });
});
