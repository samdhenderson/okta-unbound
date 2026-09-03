/**
 * The app-level refresh control's contract (ADR-0069 §2, §7).
 *
 * Two things are pinned here, and the second matters more than the first.
 *
 * **The subject is whatever the panel is showing.** A rung claims the control
 * while it is on screen and releases it when it is not, and the chrome acts on
 * the claim rather than on any per-tab configuration.
 *
 * **A press invalidates exactly that rung's keys and no more.** Over-invalidation
 * is the expensive failure: `invalidate` takes a prefix, so one segment too few
 * turns "re-read this group" into a re-walk of the org, and nothing about that is
 * visible at the call site. Both cases below therefore assert the negative — the
 * entries that must *survive* — as well as the positive.
 *
 * Fixtures use only fake placeholders (`00gFAKE…`, `00uFAKE…`) per CLAUDE.md.
 */
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { peek, resetEntityCache, setEntry } from '../cache/entityCache';
import { cacheKeys, RULE_INVENTORY_KEY } from '../cache/keys';
import { invalidateGroupDetail } from '../cache/rungInvalidation';
import { useRefreshSubject, useAppRefresh } from './useRefreshSubject';
// Imported for its import-time `registerDerived('memberSource', 'groupMembers')`
// wiring — the cascade under test is that registration, not a re-declaration of
// it here.
import '../cache/memberSourceCache';

const GROUP_ID = '00gFAKEGROUP1';
const OTHER_GROUP_ID = '00gFAKEGROUP2';
const USER_ID = '00uFAKEUSER1';
const ORIGIN = 'https://example.okta.com';

/** The chrome's half: reads whichever rung has claimed the control and fires it. */
const TopBar: React.FC<{ refetch: () => void; isPinned?: boolean }> = ({
  refetch,
  isPinned = false,
}) => {
  const { subjectName, refresh } = useAppRefresh(refetch, isPinned);
  return (
    <button type="button" onClick={refresh}>
      {subjectName === null ? 'Refresh' : `Refresh ${subjectName}`}
    </button>
  );
};

/** A rung's half: claims the control while it is the one on screen. */
const Rung: React.FC<{ name: string; run: () => void; isActive?: boolean }> = ({
  name,
  run,
  isActive = true,
}) => {
  useRefreshSubject(name, run, isActive);
  return null;
};

/** Seed one entry in every family a press might plausibly reach. */
function seedCache(): void {
  setEntry(cacheKeys.groupMembers(GROUP_ID), ['member']);
  setEntry(cacheKeys.memberSource(GROUP_ID), { direct: 1 });
  setEntry(cacheKeys.mfaScan(GROUP_ID), new Map());
  setEntry(cacheKeys.groupMembers(OTHER_GROUP_ID), ['member']);
  setEntry(cacheKeys.memberSource(OTHER_GROUP_ID), { direct: 1 });
  setEntry(cacheKeys.mfaScan(OTHER_GROUP_ID), new Map());
  setEntry(cacheKeys.userMemberships(USER_ID), []);
  setEntry(cacheKeys.apps(ORIGIN), []);
  setEntry(cacheKeys.policies('ACCESS_POLICY'), []);
  setEntry([RULE_INVENTORY_KEY], []);
}

/** Which of the seeded keys are still present. */
function survivors(): string[] {
  const entries: [string, unknown][] = [
    [`groupMembers/${GROUP_ID}`, peek(cacheKeys.groupMembers(GROUP_ID))],
    [`memberSource/${GROUP_ID}`, peek(cacheKeys.memberSource(GROUP_ID))],
    [`mfaScan/${GROUP_ID}`, peek(cacheKeys.mfaScan(GROUP_ID))],
    [`groupMembers/${OTHER_GROUP_ID}`, peek(cacheKeys.groupMembers(OTHER_GROUP_ID))],
    [`memberSource/${OTHER_GROUP_ID}`, peek(cacheKeys.memberSource(OTHER_GROUP_ID))],
    [`mfaScan/${OTHER_GROUP_ID}`, peek(cacheKeys.mfaScan(OTHER_GROUP_ID))],
    [`userMemberships/${USER_ID}`, peek(cacheKeys.userMemberships(USER_ID))],
    ['apps', peek(cacheKeys.apps(ORIGIN))],
    ['policies', peek(cacheKeys.policies('ACCESS_POLICY'))],
    [RULE_INVENTORY_KEY, peek([RULE_INVENTORY_KEY])],
  ];
  return entries.filter(([, value]) => value !== null).map(([name]) => name);
}

beforeEach(() => {
  resetEntityCache();
});

describe('the app-level refresh control', () => {
  it('names its subject in the accessible name, and shows no name when unclaimed', async () => {
    const { rerender } = render(<TopBar refetch={() => {}} />);
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();

    rerender(
      <>
        <Rung name="Payments Team" run={() => {}} />
        <TopBar refetch={() => {}} />
      </>,
    );
    expect(screen.getByRole('button', { name: 'Refresh Payments Team' })).toBeInTheDocument();
  });

  it('ignores a rung that is mounted but not on screen (ADR-0018)', () => {
    render(
      <>
        <Rung name="the rules list" run={() => {}} isActive={false} />
        <TopBar refetch={() => {}} />
      </>,
    );
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
  });

  it('acts on the pushed detail rung, and restores the list rung when it pops', () => {
    const { rerender } = render(
      <>
        <Rung name="the groups list" run={() => {}} />
        <Rung name="Payments Team" run={() => {}} />
        <TopBar refetch={() => {}} />
      </>,
    );
    expect(screen.getByRole('button', { name: 'Refresh Payments Team' })).toBeInTheDocument();

    rerender(
      <>
        <Rung name="the groups list" run={() => {}} />
        <TopBar refetch={() => {}} />
      </>,
    );
    expect(screen.getByRole('button', { name: 'Refresh the groups list' })).toBeInTheDocument();
  });

  it('skips the context re-probe while pinned but still runs the data half', async () => {
    const uev = userEvent.setup();
    const refetch = vi.fn();
    const run = vi.fn();

    render(
      <>
        <Rung name="Payments Team" run={run} />
        <TopBar refetch={refetch} isPinned />
      </>,
    );
    await uev.click(screen.getByRole('button', { name: 'Refresh Payments Team' }));

    expect(refetch).not.toHaveBeenCalled();
    expect(run).toHaveBeenCalledTimes(1);
  });

  describe('what a press invalidates', () => {
    it('on a list rung, re-runs the loader and drops no cache entry at all', async () => {
      const uev = userEvent.setup();
      seedCache();
      const before = survivors();
      const loadApps = vi.fn();

      render(
        <>
          <Rung name="the apps list" run={loadApps} />
          <TopBar refetch={() => {}} />
        </>,
      );
      await uev.click(screen.getByRole('button', { name: 'Refresh the apps list' }));

      expect(loadApps).toHaveBeenCalledTimes(1);
      // The list rungs re-fetch through their own loaders' `force` path, so a
      // press must not reach `entityCache` at all. Anything dropped here is
      // work some *other* rung already paid for.
      expect(survivors()).toEqual(before);
    });

    it("on a detail rung, drops that group's three keys and nothing else", async () => {
      const uev = userEvent.setup();
      seedCache();
      const reloadRungHooks = vi.fn();

      render(
        <>
          <Rung
            name="Payments Team"
            run={() => {
              invalidateGroupDetail(GROUP_ID);
              reloadRungHooks();
            }}
          />
          <TopBar refetch={() => {}} />
        </>,
      );
      await uev.click(screen.getByRole('button', { name: 'Refresh Payments Team' }));

      expect(reloadRungHooks).toHaveBeenCalledTimes(1);
      expect(survivors()).toEqual([
        `groupMembers/${OTHER_GROUP_ID}`,
        `memberSource/${OTHER_GROUP_ID}`,
        `mfaScan/${OTHER_GROUP_ID}`,
        `userMemberships/${USER_ID}`,
        'apps',
        'policies',
        RULE_INVENTORY_KEY,
      ]);
    });

    it("cascades the group's member-source breakdown off its roster", () => {
      seedCache();
      act(() => invalidateGroupDetail(GROUP_ID));
      // Not invalidated by name — `registerDerived('memberSource', 'groupMembers')`
      // is what drops it, and a breakdown outliving the roster it summarises is a
      // wrong count on screen rather than a stale one.
      expect(peek(cacheKeys.memberSource(GROUP_ID))).toBeNull();
    });
  });
});
