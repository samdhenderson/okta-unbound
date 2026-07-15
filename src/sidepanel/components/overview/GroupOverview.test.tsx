/**
 * Regression tests for GroupOverview's member-load effect.
 *
 * GroupOverview used to wrap `getAllGroupMembers`/`scanGroupMfa` in refs to keep its
 * load effect from re-firing when `useOktaApi` returned fresh function identities
 * every render. `useOktaApi` is now memoized (its identity stability is pinned in
 * `useOktaApi.test.ts`), so the refs were removed. These tests are the safety net:
 * with a stable api the load must fire exactly once per group and never loop, and it
 * must still re-fire when `groupId` changes.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';

// A single stable api object — same identities every render, exactly like the
// memoized useOktaApi. The whole point is that GroupOverview does not re-load when
// these identities stay put across re-renders.
const api = vi.hoisted(() => ({
  getAllGroupMembers: vi.fn(async () => [] as unknown[]),
  removeDeprovisioned: vi.fn(async () => {}),
  exportMembers: vi.fn(async () => {}),
  scanGroupMfa: vi.fn(async () => new Map()),
  isLoading: false,
}));

vi.mock('../../hooks/useOktaApi', () => ({
  useOktaApi: () => api,
}));

const progress = vi.hoisted(() => ({
  startProgress: vi.fn(),
  completeProgress: vi.fn(),
  updateProgress: vi.fn(),
  incrementApiCalls: vi.fn(),
  progress: { isLoading: false, current: 0, total: 0, message: '', apiCalls: 0 },
}));

vi.mock('../../contexts/ProgressContext', () => ({
  useProgress: () => progress,
}));

vi.mock('./members/MemberExplorer', () => ({
  default: () => <div data-testid="member-explorer" />,
}));

import GroupOverview from './GroupOverview';

const baseProps = {
  groupId: 'g1',
  groupName: 'Group One',
  targetTabId: 1,
  onTabChange: () => {},
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GroupOverview member-load effect', () => {
  it('loads members exactly once on mount and does NOT loop across unrelated re-renders', async () => {
    const { rerender } = render(<GroupOverview {...baseProps} />);

    await waitFor(() => expect(api.getAllGroupMembers).toHaveBeenCalledTimes(1));
    expect(api.getAllGroupMembers).toHaveBeenCalledWith('g1');

    // Force several re-renders with an unrelated prop change. A stale dep array (or a
    // reintroduced instability) would re-fire the effect here.
    for (let i = 0; i < 5; i++) {
      rerender(<GroupOverview {...baseProps} oktaOrigin={`https://x${i}.okta.com`} />);
    }
    // Let any (unwanted) queued effects flush.
    await new Promise((r) => setTimeout(r, 0));

    expect(api.getAllGroupMembers).toHaveBeenCalledTimes(1);
  });

  it('re-loads when groupId changes', async () => {
    const { rerender } = render(<GroupOverview {...baseProps} />);
    await waitFor(() => expect(api.getAllGroupMembers).toHaveBeenCalledWith('g1'));

    rerender(<GroupOverview {...baseProps} groupId="g2" />);
    await waitFor(() => expect(api.getAllGroupMembers).toHaveBeenCalledWith('g2'));

    expect(api.getAllGroupMembers).toHaveBeenCalledTimes(2);
  });
});
