/**
 * Tests for the ActivityBar container — the responsive collapse wiring and the
 * confirm-gated Cancel path.
 *
 * The pure layout is covered by ActivityBarView.test.tsx; here we exercise the
 * container's own logic: it condenses on a narrow panel, expands on the chevron,
 * shows the full row (no toggle) on a wide panel, and routes Cancel through a
 * window.confirm before draining the scheduler queue.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import ActivityBar from './ActivityBar';
import { SchedulerProvider } from '../contexts/SchedulerContext';
import { ProgressProvider } from '../contexts/ProgressContext';

const wrapper = ({ children }: { children: ReactNode }) => (
  <ProgressProvider>
    <SchedulerProvider>{children}</SchedulerProvider>
  </ProgressProvider>
);

const sendMessage = chrome.runtime.sendMessage as ReturnType<typeof vi.fn>;

/** Set the jsdom panel width (innerWidth is redefinable with configurable: true). */
function setWidth(px: number): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: px });
}

beforeEach(() => {
  sendMessage.mockReset();
  sendMessage.mockImplementation((msg: { action: string }) => {
    if (msg.action === 'getSchedulerState') {
      return Promise.resolve({
        success: true,
        state: {
          status: 'processing',
          queueLength: 6,
          activeRequests: 2,
          totalProcessed: 4,
          rateLimitInfo: { limit: 600, remaining: 550, reset: 0, endpoint: '/x', timestamp: 0 },
          cooldownEndsAt: null,
          errorCount: 0,
          lastError: null,
        },
      });
    }
    if (msg.action === 'getSchedulerMetrics') {
      return Promise.resolve({ success: true, metrics: { failedRequests: 1 } });
    }
    return Promise.resolve({ success: true });
  });
});

describe('ActivityBar', () => {
  it('condenses on a narrow panel and expands when the chevron is clicked', async () => {
    setWidth(400);
    render(<ActivityBar />, { wrapper });

    await waitFor(() => expect(screen.getByTestId('activity-rate-compact')).toBeInTheDocument());
    // Condensed: the boxed metric slots are hidden.
    expect(screen.queryByTestId('activity-queue')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /show all activity stats/i }));

    // Expanded: the full slots are back.
    expect(screen.getByTestId('activity-queue')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /hide extra activity stats/i })).toBeInTheDocument();
  });

  it('shows the full row with no collapse toggle on a wide panel', async () => {
    setWidth(1200);
    render(<ActivityBar />, { wrapper });

    await waitFor(() => expect(screen.getByTestId('activity-queue')).toHaveTextContent('6'));
    expect(screen.queryByRole('button', { name: /activity stats/i })).not.toBeInTheDocument();
  });

  it('confirms then drains the queue on Cancel', async () => {
    setWidth(1200);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<ActivityBar />, { wrapper });

    await waitFor(() => expect(screen.getByTestId('activity-queue')).toHaveTextContent('6'));
    const actions = screen.getByTestId('activity-actions');
    fireEvent.click(within(actions).getByRole('button', { name: /cancel/i }));

    expect(confirmSpy).toHaveBeenCalled();
    await waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith({ action: 'clearSchedulerQueue' }),
    );
    confirmSpy.mockRestore();
  });

  it('does not cancel when the confirm is dismissed', async () => {
    setWidth(1200);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<ActivityBar />, { wrapper });

    await waitFor(() => expect(screen.getByTestId('activity-queue')).toHaveTextContent('6'));
    fireEvent.click(
      within(screen.getByTestId('activity-actions')).getByRole('button', { name: /cancel/i }),
    );

    expect(confirmSpy).toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalledWith({ action: 'clearSchedulerQueue' });
    confirmSpy.mockRestore();
  });
});
