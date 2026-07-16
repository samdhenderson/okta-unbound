/**
 * Tests for ActivityBarView — the pure presentation of the unified activity bar.
 *
 * This bar replaces the two overlapping bottom bars (scheduler status + operation
 * progress). The tests pin the properties the redesign is meant to guarantee:
 *  - a SINGLE bar with a slim persistent idle state (status + rate-limit always shown),
 *  - STABLE layout — the metric slots and the action area are always in the DOM, so
 *    values appearing/disappearing never reflows the row (the old jank),
 *  - one Cancel affordance that is enabled exactly when there is something to cancel
 *    (an active operation or a non-empty queue) and reflects the cancelling state.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import ActivityBarView from './ActivityBarView';
import type { ActivityView } from '../hooks/useActivityBar';

/** A fully idle, empty view — the slim persistent baseline. */
function idleView(overrides: Partial<ActivityView> = {}): ActivityView {
  return {
    statusLabel: 'Ready',
    statusColorVar: 'var(--color-success)',
    busy: false,
    operationActive: false,
    operationName: undefined,
    message: undefined,
    current: 0,
    total: 0,
    percentage: 0,
    elapsedLabel: undefined,
    etaLabel: undefined,
    apiCalls: undefined,
    queueLength: 0,
    activeRequests: 0,
    rateLimit: { remaining: 600, limit: 600, low: false },
    cooldownLabel: undefined,
    processed: 0,
    failed: 0,
    opCompleted: 0,
    opActive: 0,
    opFailed: 0,
    isCancelling: false,
    canCancel: false,
    ...overrides,
  };
}

const renderView = (view: ActivityView, onCancel = vi.fn()) => {
  render(<ActivityBarView view={view} onCancel={onCancel} />);
  return { onCancel };
};

describe('ActivityBarView', () => {
  it('renders a single slim bar when idle: status + rate limit, no operation', () => {
    renderView(idleView());
    expect(screen.getByText('Ready')).toBeInTheDocument();
    // Rate limit is always shown in the persistent slot.
    expect(screen.getByTestId('activity-rate-limit')).toHaveTextContent('600/600');
    // No operation name / progress when idle.
    expect(screen.queryByTestId('activity-operation-name')).not.toBeInTheDocument();
  });

  it('keeps the metric slots and action area mounted across idle → active (no reflow)', () => {
    const { unmount } = render(<ActivityBarView view={idleView()} onCancel={vi.fn()} />);
    // The stable slots exist even when their values are empty.
    for (const id of ['activity-queue', 'activity-active', 'activity-rate-limit', 'activity-eta']) {
      expect(screen.getByTestId(id)).toBeInTheDocument();
    }
    expect(screen.getByTestId('activity-actions')).toBeInTheDocument();
    unmount();

    render(
      <ActivityBarView
        view={idleView({
          operationActive: true,
          operationName: 'Removing users',
          busy: true,
          current: 3,
          total: 10,
          percentage: 30,
          queueLength: 4,
          activeRequests: 2,
          canCancel: true,
        })}
        onCancel={vi.fn()}
      />,
    );
    // Same stable slots are present in the active render.
    for (const id of ['activity-queue', 'activity-active', 'activity-rate-limit', 'activity-eta']) {
      expect(screen.getByTestId(id)).toBeInTheDocument();
    }
    expect(screen.getByTestId('activity-actions')).toBeInTheDocument();
  });

  it('shows operation name, progress counter and ETA when an operation is active', () => {
    renderView(
      idleView({
        operationActive: true,
        operationName: 'Exporting members',
        busy: true,
        current: 4,
        total: 20,
        percentage: 20,
        elapsedLabel: '0:12',
        etaLabel: '~0:48 left',
        apiCalls: 4,
      }),
    );
    expect(screen.getByTestId('activity-operation-name')).toHaveTextContent('Exporting members');
    expect(screen.getByTestId('activity-progress-counter')).toHaveTextContent('4 / 20');
    expect(screen.getByTestId('activity-eta')).toHaveTextContent('0:48');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '20');
  });

  it('shows the operation breakdown (done / active / failed) while running', () => {
    renderView(
      idleView({
        operationActive: true,
        operationName: 'Removing deprovisioned users',
        busy: true,
        current: 20,
        total: 30,
        percentage: 67,
        opCompleted: 18,
        opActive: 5,
        opFailed: 2,
      }),
    );
    const breakdown = screen.getByTestId('activity-op-breakdown');
    expect(breakdown).toHaveTextContent('18 done');
    expect(breakdown).toHaveTextContent('5 active');
    expect(breakdown).toHaveTextContent('2 failed');
  });

  it('omits the operation breakdown when idle', () => {
    renderView(idleView());
    expect(screen.queryByTestId('activity-op-breakdown')).not.toBeInTheDocument();
  });

  it('shows queue and active counts when present', () => {
    renderView(idleView({ queueLength: 7, activeRequests: 3 }));
    expect(screen.getByTestId('activity-queue')).toHaveTextContent('7');
    expect(screen.getByTestId('activity-active')).toHaveTextContent('3');
  });

  it('shows a cooldown countdown when cooling down', () => {
    renderView(idleView({ statusLabel: 'Cooldown', cooldownLabel: '12s' }));
    expect(screen.getByTestId('activity-eta')).toHaveTextContent('12s');
  });

  it('flags a low rate-limit budget for the user', () => {
    renderView(idleView({ rateLimit: { remaining: 20, limit: 600, low: true } }));
    expect(screen.getByTestId('activity-rate-limit')).toHaveAttribute('data-low', 'true');
  });

  it('enables Cancel and fires onCancel when there is work to cancel', () => {
    const { onCancel } = renderView(idleView({ queueLength: 5, canCancel: true }));
    const cancel = screen.getByRole('button', { name: /cancel/i });
    expect(cancel).toBeEnabled();
    fireEvent.click(cancel);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('disables Cancel when there is nothing to cancel', () => {
    renderView(idleView({ canCancel: false }));
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
  });

  it('reflects the cancelling state on the action', () => {
    renderView(idleView({ operationActive: true, canCancel: true, isCancelling: true }));
    const actions = screen.getByTestId('activity-actions');
    expect(within(actions).getByRole('button')).toBeDisabled();
    expect(actions).toHaveTextContent(/cancel/i);
  });
});
