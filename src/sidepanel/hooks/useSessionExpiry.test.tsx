/**
 * Tests for `useSessionExpiry` — the panel's read of the one session-expiry
 * signal the background scheduler publishes (ADR-0054, `D-007b`).
 *
 * The point of the item is that an expired session becomes **one** statement
 * instead of a failed-request error state on every mounted surface, so what is
 * pinned here is that the signal is global (it arrives on the scheduler
 * broadcast, not from a call site), that it is scoped to the tab the panel is
 * driving, and that it *clears* — a fix that could not recover would only trade
 * thirty errors for one permanent banner.
 *
 * The consumer under test renders the same `AlertMessage` `App` mounts, so the
 * admin-facing copy is pinned alongside the state.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { SchedulerProvider } from '../contexts/SchedulerContext';
import { useSessionExpiry } from './useSessionExpiry';
import AlertMessage from '../components/shared/AlertMessage';
import type { SchedulerState } from '../../shared/scheduler/types';

const sendMessage = chrome.runtime.sendMessage as ReturnType<typeof vi.fn>;
const addListener = chrome.runtime.onMessage.addListener as ReturnType<typeof vi.fn>;

const baseState: SchedulerState = {
  status: 'idle',
  queueLength: 0,
  activeRequests: 0,
  totalProcessed: 0,
  rateLimitInfo: null,
  cooldownEndsAt: null,
  errorCount: 0,
  lastError: null,
  buckets: [],
  plans: [],
  minRemainingThresholdPercent: 10,
  expiredSessionTabIds: [],
};

/** The banner `App` mounts under `ContextBar`, in miniature. */
function Notice({ targetTabId }: { targetTabId: number | null }) {
  const expired = useSessionExpiry(targetTabId);
  if (!expired) return null;
  return (
    <AlertMessage
      message={{
        type: 'danger',
        text: 'Your Okta session has expired. Sign in again in the Okta tab — the panel has stopped sending requests and picks up again on its own once Okta answers.',
      }}
    />
  );
}

/** Invoke the most recently registered runtime.onMessage listener. */
function pushState(state: SchedulerState): void {
  const listener = addListener.mock.calls.at(-1)?.[0] as (m: unknown) => void;
  act(() => listener({ action: 'schedulerStateChanged', state }));
}

function renderNotice(targetTabId: number | null) {
  return render(
    <SchedulerProvider>
      <Notice targetTabId={targetTabId} />
    </SchedulerProvider>,
  );
}

beforeEach(() => {
  sendMessage.mockReset();
  addListener.mockReset();
  sendMessage.mockImplementation((msg: { action: string }) => {
    if (msg.action === 'getSchedulerState') {
      return Promise.resolve({ success: true, state: baseState });
    }
    if (msg.action === 'getSchedulerMetrics') {
      return Promise.resolve({ success: true, metrics: {} });
    }
    return Promise.resolve({ success: true });
  });
});

describe('useSessionExpiry', () => {
  it('says nothing while the scheduler reports no expired session', async () => {
    renderNotice(1);
    await waitFor(() => expect(sendMessage).toHaveBeenCalled());
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('states the expiry once, in plain language, when the scheduler reports it', async () => {
    renderNotice(1);
    await waitFor(() => expect(sendMessage).toHaveBeenCalled());

    pushState({ ...baseState, expiredSessionTabIds: [1] });

    const alerts = screen.getAllByRole('alert');
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toHaveTextContent(/Your Okta session has expired/);
    expect(alerts[0]).toHaveTextContent(/Sign in again in the Okta tab/);
  });

  it('clears the notice when the session answers again', async () => {
    renderNotice(1);
    await waitFor(() => expect(sendMessage).toHaveBeenCalled());

    pushState({ ...baseState, expiredSessionTabIds: [1] });
    expect(screen.getByRole('alert')).toBeInTheDocument();

    // Recovery is the scheduler unpublishing the tab after a request for it
    // succeeded — the same broadcast that resumes normal scheduling.
    pushState({ ...baseState, expiredSessionTabIds: [] });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('does not report another tab’s expired session', async () => {
    renderNotice(1);
    await waitFor(() => expect(sendMessage).toHaveBeenCalled());

    pushState({ ...baseState, expiredSessionTabIds: [2] });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('reports nothing when the panel is not driving a tab', async () => {
    renderNotice(null);
    await waitFor(() => expect(sendMessage).toHaveBeenCalled());

    pushState({ ...baseState, expiredSessionTabIds: [1] });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('treats a state that predates the field as “nothing known”, never as expired', async () => {
    renderNotice(1);
    await waitFor(() => expect(sendMessage).toHaveBeenCalled());

    const legacy = { ...baseState };
    delete legacy.expiredSessionTabIds;
    pushState(legacy);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
