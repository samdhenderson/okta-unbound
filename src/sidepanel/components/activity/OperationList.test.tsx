/**
 * Tests for the operation ledger in the expanded activity bar.
 *
 * What matters here is that the ledger is honest about two things the old
 * single progress bar could not express: that several operations can be running
 * at once, and that a declared total may be a floor rather than a fact. The
 * per-operation stop control is the third — it has to name and stop exactly one
 * operation, or "cancel" is back to meaning "cancel everything".
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OperationList from './OperationList';
import { budgetLabel, operationBuckets } from './OperationRow';
import type { PlanSummary } from '@/shared/scheduler/plan';

function leg(bucket: string, estimated: number | null, spent = 0) {
  return {
    id: `${bucket}-leg`,
    bucket,
    method: 'GET',
    estimated,
    spent,
    remaining: estimated === null ? null : Math.max(0, estimated - spent),
    approximate: false,
  };
}

function plan(overrides: Partial<PlanSummary> & { id: string; name: string }): PlanSummary {
  return {
    startedAt: 1_760_000_000_000,
    legs: [leg('/api/v1/users', 50)],
    spent: 0,
    estimated: 50,
    remaining: 50,
    approximate: false,
    ...overrides,
  };
}

describe('budgetLabel', () => {
  it('marks an approximate total with a tilde', () => {
    // An operation that promised 50 and one that promised *at least* 50 behave
    // very differently against a quota; collapsing them would make the ledger
    // untrustworthy the first time a walk ran long.
    expect(budgetLabel(plan({ id: 'p', name: 'Export', spent: 12, approximate: true }))).toBe(
      '12 / ~50',
    );
  });

  it('drops the tilde once every leg is exact', () => {
    expect(budgetLabel(plan({ id: 'p', name: 'Export', spent: 12 }))).toBe('12 / 50');
  });

  it('shows the spent count alone when nothing could be estimated', () => {
    expect(
      budgetLabel(plan({ id: 'p', name: 'Export', spent: 7, estimated: null, remaining: null })),
    ).toBe('7');
  });
});

describe('operationBuckets', () => {
  it('lists each bucket once, however many legs draw on it', () => {
    const buckets = operationBuckets(
      plan({
        id: 'p',
        name: 'Scan MFA',
        legs: [leg('/api/v1/users', 4), leg('/api/v1/groups', 2), leg('/api/v1/users', 1)],
      }),
    );

    expect(buckets).toEqual(['/api/v1/users', '/api/v1/groups']);
  });
});

describe('OperationList', () => {
  it('renders nothing when no operation has declared work', () => {
    const { container } = render(<OperationList operations={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('shows concurrent operations as separate rows', () => {
    // The single progress bar above can only ever describe one of these. That
    // it cannot is the reason this component exists.
    render(
      <OperationList
        operations={[
          plan({ id: 'export', name: 'Export all users', spent: 12 }),
          plan({ id: 'search', name: 'Search groups', spent: 1, estimated: 2, remaining: 1 }),
        ]}
      />,
    );

    expect(screen.getByTestId('activity-operation-export')).toHaveTextContent('Export all users');
    expect(screen.getByTestId('activity-operation-export')).toHaveTextContent('12 / 50');
    expect(screen.getByTestId('activity-operation-search')).toHaveTextContent('Search groups');
  });

  it('names the buckets an operation draws from', () => {
    render(
      <OperationList
        operations={[
          plan({
            id: 'scan',
            name: 'Scan MFA',
            legs: [leg('/api/v1/users', 4), leg('/api/v1/groups', 2)],
          }),
        ]}
      />,
    );

    expect(screen.getByTestId('activity-operation-scan')).toHaveTextContent('users, groups');
  });

  it('stops exactly the operation whose control was pressed', async () => {
    const onCancelOperation = vi.fn();
    render(
      <OperationList
        operations={[
          plan({ id: 'export', name: 'Export all users' }),
          plan({ id: 'search', name: 'Search groups' }),
        ]}
        onCancelOperation={onCancelOperation}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Stop Search groups' }));

    expect(onCancelOperation).toHaveBeenCalledExactlyOnceWith('search');
  });

  it('offers no stop control when the ledger is read-only', () => {
    render(<OperationList operations={[plan({ id: 'export', name: 'Export all users' })]} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('counts the overflow rather than growing without bound', () => {
    render(
      <OperationList
        operations={[
          plan({ id: 'a', name: 'A' }),
          plan({ id: 'b', name: 'B' }),
          plan({ id: 'c', name: 'C' }),
        ]}
        maxRows={2}
      />,
    );

    expect(screen.getByTestId('activity-operations-overflow')).toHaveTextContent(
      '+ 1 more operation',
    );
    expect(screen.queryByTestId('activity-operation-c')).not.toBeInTheDocument();
  });
});
