/**
 * Tests for useHomeReports — the projection from snapshot rows onto the reports.
 *
 * The pure joins and the honesty rules have their own subjects
 * (`components/groups/ruleOrphans`, `components/home/homeReports`). What is left
 * here is what only exists at this layer: the hook reads app-group assignments
 * through `records` rather than `rows` — the app is in the compound key and
 * nowhere else — and it issues nothing at all, because the one top-up Home is
 * allowed to spend belongs to `useOrgFigures`.
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useHomeReports, type UseHomeReportsResult } from './useHomeReports';
import type { OrgEntityIndex } from './useOrgEntityIndex';

const DAY = 24 * 60 * 60 * 1000;
/**
 * The stubs' walk stamp, and the reference every date in this file is written
 * against. Relative to the real clock rather than fixed, because the dormant
 * report's anchor is only usable when the last full walk is recent — a frozen
 * stamp would decide that for the test by accident.
 */
const NOW = Date.now();

const daysBefore = (days: number) => new Date(NOW - days * DAY).toISOString();

interface StubOptions {
  complete?: boolean;
  lastFullWalkAt?: number | null;
  isReading?: boolean;
  /** Overrides applied to the rules handle only, so one collection can lag. */
  rulesOver?: Partial<StubOptions>;
}

const sync = vi.fn(async () => null);

function stub(rows: unknown[], options: StubOptions, records: { id: string }[] = []) {
  const { lastFullWalkAt = NOW, isReading = false, complete = true } = options;
  return {
    rows,
    records,
    isReading,
    complete,
    lastFullWalkAt,
    isSyncing: false,
    error: null,
    sync,
  };
}

/**
 * A small org with one of each shape:
 *
 * - `g1` is empty, unfilled and unassigned — the cleanup finding.
 * - `g2` is empty but a rule fills it.
 * - `g3` has members and is assigned to an app that no rule fills — the access
 *   finding.
 * - `g4` is empty and assigned to an app, so it is neither: deleting it would
 *   revoke the access it is holding open.
 */
function makeIndex(options: StubOptions = {}): OrgEntityIndex {
  const groups = [
    { id: 'g1', type: 'OKTA_GROUP', profile: { name: 'Abandoned' } },
    { id: 'g2', type: 'OKTA_GROUP', profile: { name: 'Filled' } },
    {
      id: 'g3',
      type: 'OKTA_GROUP',
      profile: { name: 'Sales tools' },
      _embedded: { stats: { usersCount: 12 } },
      lastMembershipUpdated: daysBefore(730),
    },
    { id: 'g4', type: 'OKTA_GROUP', profile: { name: 'Holds an app open' } },
  ];
  const rules = [{ id: 'r1', actions: { assignUserToGroups: { groupIds: ['g2'] } } }];
  const apps = [{ id: 'a1', label: 'Slack', features: ['GROUP_PUSH'] }];
  return {
    lookup: () => ({ status: 'unknown' }),
    isAuthoritative: () => true,
    groups: stub(groups, options),
    rules: stub(rules, { ...options, ...options.rulesOver }),
    apps: stub(apps, options),
    appGroups: stub([{ id: 'g3' }, { id: 'g4' }], options, [{ id: 'a1::g3' }, { id: 'a1::g4' }]),
  } as unknown as OrgEntityIndex;
}

const render = (index: OrgEntityIndex) => renderHook(() => useHomeReports({ index }));

const report = (result: UseHomeReportsResult, key: string) =>
  result.reports.find((entry) => entry.key === key);

describe('useHomeReports', () => {
  it('derives both reports from rows already held, and issues nothing', () => {
    sync.mockClear();
    const { result } = render(makeIndex());
    expect(result.current.reports.map((entry) => entry.key)).toEqual([
      'group-cleanup',
      'unmaintained-app-access',
      'dormant-app-access',
    ]);
    expect(sync).not.toHaveBeenCalled();
  });

  it('finds the abandoned group and no other', () => {
    const { result } = render(makeIndex());
    const cleanup = report(result.current, 'group-cleanup');
    expect(cleanup?.value).toBe(1);
    expect(cleanup?.findings.map((finding) => finding.name)).toEqual(['Abandoned']);
  });

  it('names the app from the record key, not from the assignment row', () => {
    // The assignment entity's `id` is the *group's* id, so a hook reading `rows`
    // could not say which app an assignment belongs to at all — and the two
    // stub entities here deliberately carry no app id to fall back on.
    const { result } = render(makeIndex());
    const access = report(result.current, 'unmaintained-app-access');
    expect(access?.value).toBe(1);
    expect(access?.findings).toEqual([
      { id: 'g3', name: 'Sales tools', detail: '12 members · Slack' },
    ]);
  });

  it('withholds both reports, names and all, when the rules were never read', () => {
    // Rules gate both: they are subtracted, so a half-read rule list does not
    // shorten these answers, it corrupts them.
    const { result } = render(makeIndex({ rulesOver: { complete: false, lastFullWalkAt: null } }));
    for (const entry of result.current.reports) {
      expect(entry.value).toBeNull();
      expect(entry.findings).toEqual([]);
      expect(entry.note).toBe('Needs group rules, which have not been read.');
    }
  });
});

/**
 * The dormant report's clock (ADR-0067 §3). The join and its copy are tested in
 * `components/groups/ruleOrphans`; what only exists here is where the anchor
 * comes from — the group handle's `lastFullWalkAt` — and what the reader is
 * shown when it cannot carry a claim.
 */
describe('useHomeReports · the dormant report', () => {
  const dormant = (result: UseHomeReportsResult) => report(result, 'dormant-app-access');

  it('states the silence it observed, measured from the last complete group read', () => {
    const { result } = render(makeIndex());
    expect(dormant(result.current)?.label).toBe('App access with no membership change in 6 months');
    expect(dormant(result.current)?.value).toBe(1);
    expect(dormant(result.current)?.findings).toEqual([
      {
        id: 'g3',
        name: 'Sales tools',
        detail: '12 members · Slack · no membership change in 2 years',
      },
    ]);
    expect(dormant(result.current)?.caveat).toContain(
      'Measured from the last complete read of your groups,',
    );
  });

  it('withholds the report entirely when the groups were never fully walked', () => {
    const { result } = render(makeIndex({ complete: false, lastFullWalkAt: null }));
    expect(dormant(result.current)?.value).toBeNull();
    expect(dormant(result.current)?.findings).toEqual([]);
  });

  it('withholds the report when the anchor is too old to certify a silence', () => {
    // Every collection here read cleanly — the count is suppressed purely
    // because the walk it would be measured from is 60 days behind. Without
    // this, a group that gained fifty members yesterday but whose profile was
    // last edited in 2021 reads as dormant with high confidence, forever.
    const { result } = render(makeIndex({ lastFullWalkAt: NOW - 60 * DAY }));
    expect(dormant(result.current)).toMatchObject({ status: 'unavailable', value: null });
    expect(dormant(result.current)?.findings).toEqual([]);
    expect(dormant(result.current)?.note).toContain(
      'Needs a complete read of your groups from the last 30 days.',
    );
    // The sibling report is unaffected: its claim does not rest on the anchor.
    expect(report(result.current, 'unmaintained-app-access')?.value).toBe(1);
  });

  it('offers nothing to act on — the findings navigate and nothing more', () => {
    // ADR-0067 §5. A finding is an id, a name and a line of prose; there is no
    // verb, no selection and no path into the bulk machinery from this shape.
    const { result } = render(makeIndex());
    for (const finding of dormant(result.current)?.findings ?? []) {
      expect(Object.keys(finding).sort()).toEqual(['detail', 'id', 'name']);
    }
  });
});
