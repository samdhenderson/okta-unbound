/**
 * @module sidepanel/components/activity/OperationList
 * @description The operation ledger at the top of the expanded activity bar.
 *
 * Renders every operation that has declared a budget, oldest first, so
 * concurrent work is legible as several rows rather than collapsed into one
 * progress bar. Renders nothing when nothing has been declared — an idle bar
 * stays exactly as slim as it was (ADR-0008).
 *
 * @see `ADR-0060` — the declared-work ledger.
 */
import React from 'react';
import type { PlanSummary } from '@/shared/scheduler/plan';
import OperationRow from './OperationRow';

/** Props for {@link OperationList}. */
export interface OperationListProps {
  /** Active plans as published by the scheduler, oldest first. */
  operations: PlanSummary[];
  /** Stops one operation. Omit to render the ledger read-only. */
  onCancelOperation?: (planId: string) => void;
  /**
   * Cap on rows. Beyond it the overflow is counted rather than listed, because a
   * bar taller than the content it sits under has stopped being a status bar.
   */
  maxRows?: number;
}

/**
 * Render the operation ledger, or nothing when no operation has declared work.
 *
 * @param props - See {@link OperationListProps}.
 */
const OperationList: React.FC<OperationListProps> = ({
  operations,
  onCancelOperation,
  maxRows = 3,
}) => {
  if (operations.length === 0) return null;

  const shown = operations.slice(0, maxRows);
  const hidden = operations.length - shown.length;

  return (
    <div data-testid="activity-operations" className="border-t border-neutral-100">
      {shown.map((operation) => (
        <OperationRow key={operation.id} operation={operation} onCancel={onCancelOperation} />
      ))}
      {hidden > 0 && (
        <div
          data-testid="activity-operations-overflow"
          className="px-(--sp-gutter) py-1 text-xs text-neutral-500"
        >
          + {hidden} more {hidden === 1 ? 'operation' : 'operations'}
        </div>
      )}
    </div>
  );
};

export default OperationList;
