/**
 * @module sidepanel/components/activity/OperationRow
 * @description One declared operation in the expanded activity bar: what it is,
 * how much of its request budget it has spent, which buckets it is drawing from,
 * and a control that stops it without stopping anything else.
 *
 * The progress bar above can only ever describe one operation, because it tracks
 * a single foreground loop. The scheduler's ledger has no such limit — a
 * background export and a foreground search are two plans side by side — so this
 * row is how the second, third and fourth become visible at all.
 *
 * @see `ADR-0060` — the declared-work ledger these rows render.
 */
import React from 'react';
import type { PlanSummary } from '@/shared/scheduler/plan';
import { IconButton } from '../shared';
import Icon from '../shared/Icon';
import PipelineMeter from './PipelineMeter';

/** Props for {@link OperationRow}. */
export interface OperationRowProps {
  /** The plan as published by the scheduler. */
  operation: PlanSummary;
  /** Stops this operation alone. Omit to render the row without a cancel control. */
  onCancel?: (planId: string) => void;
}

/** Short bucket label: `/api/v1/users` reads as `users`. */
function bucketLabel(bucket: string): string {
  return bucket.replace(/^\/api\/v1\//, '');
}

/**
 * The distinct buckets an operation draws from, in declaration order.
 *
 * Which buckets an operation touches is the thing that explains *why* it is
 * slow: a plan waiting on an exhausted `/api/v1/users` is stalled for a reason
 * the bucket rows below already show.
 */
export function operationBuckets(operation: PlanSummary): string[] {
  const seen = new Set<string>();
  for (const leg of operation.legs) seen.add(leg.bucket);
  return [...seen];
}

/**
 * How the budget reads: `12 / ~50` while it is a floor, `12 / 50` once exact,
 * and just the spent count when nothing has been estimated at all.
 *
 * The tilde is doing real work. An operation that promised 50 requests and an
 * operation that has promised *at least* 50 behave very differently against a
 * quota, and collapsing the two would make the ledger untrustworthy the first
 * time a walk ran long.
 */
export function budgetLabel(operation: PlanSummary): string {
  if (operation.estimated === null) return `${operation.spent}`;
  return `${operation.spent} / ${operation.approximate ? '~' : ''}${operation.estimated}`;
}

/**
 * Render one operation's row.
 *
 * @param props - See {@link OperationRowProps}.
 */
const OperationRow: React.FC<OperationRowProps> = ({ operation, onCancel }) => {
  const buckets = operationBuckets(operation);
  const remaining = operation.remaining ?? 0;

  return (
    <div
      data-testid={`activity-operation-${operation.id}`}
      className="flex flex-col gap-1 px-(--sp-gutter) py-1.5"
    >
      <div className="flex items-baseline gap-2 text-xs">
        <span className="truncate font-medium text-neutral-900">{operation.name}</span>
        {buckets.length > 0 && (
          <span className="truncate text-neutral-500">{buckets.map(bucketLabel).join(', ')}</span>
        )}
        <span
          data-testid={`activity-operation-budget-${operation.id}`}
          className="ml-auto shrink-0 tabular-nums text-neutral-600"
        >
          {budgetLabel(operation)}
        </span>
        {onCancel && (
          <IconButton
            label={`Stop ${operation.name}`}
            variant="subtle"
            size="sm"
            onClick={() => onCancel(operation.id)}
          >
            <Icon type="close" size="sm" />
          </IconButton>
        )}
      </div>
      <PipelineMeter
        counts={{ spent: operation.spent, active: 0, queued: 0, planned: remaining }}
        approximate={operation.approximate}
        label={`${operation.name}: ${operation.spent} requests spent, ${
          operation.approximate ? 'at least ' : ''
        }${remaining} to come`}
      />
    </div>
  );
};

export default OperationRow;
