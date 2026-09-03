/**
 * @module sidepanel/components/members/BreakdownDetailsModal
 * @description Modal showing the full value distribution for one composition dimension.
 *
 * Displays every value (including those collapsed into "Other" in the summary) as
 * a scrollable {@link BreakdownReport}, with a "Copy all" of the real value labels.
 * Each row toggles a member-list filter when the caller wires one.
 */
import React from 'react';
import Modal from '../shared/Modal';
import Button from '../shared/Button';
import CopyButton from '../shared/CopyButton';
import ScrollableList from '../shared/ScrollableList';
import BreakdownReport from './BreakdownReport';
import { type BreakdownRow, NONE_VALUE, OTHER_VALUE } from './memberAnalytics';
import type { BreakdownRowIntent } from './BreakdownReport';

/** Props for {@link BreakdownDetailsModal}. */
interface BreakdownDetailsModalProps {
  /** Whether the modal is open. */
  isOpen: boolean;
  /** Close the modal. */
  onClose: () => void;
  /** Modal heading (usually the dimension's display title). */
  title: string;
  /** The complete (un-aggregated) value distribution for the dimension. */
  rows: BreakdownRow[];
  /** Canonical values currently active as filters, for row highlighting. */
  activeValues: Set<string>;
  /**
   * Toggle a value as a member-list filter. **Omit on surfaces with no member
   * list to filter** (the Insights tab's attribute cards): the rows then render
   * inert and the blurb drops the "click to filter" promise rather than
   * offering an affordance that does nothing.
   */
  onRowClick?: (row: BreakdownRow) => void;
  /**
   * What a row's activation does — see
   * {@link module:sidepanel/components/members/BreakdownReport}. `navigate`
   * changes both the lead sentence and every row, so the reveal states that it
   * is a way *out* of this surface before anyone takes it.
   */
  rowIntent?: BreakdownRowIntent;
}

/**
 * Shows the full value distribution for a composition dimension — including the
 * values that were collapsed into the "Other" row — in a scrollable modal.
 * Each value is clickable to toggle it as a filter when `onRowClick` is wired;
 * without it the modal is a read-only reveal.
 */
const BreakdownDetailsModal: React.FC<BreakdownDetailsModalProps> = ({
  isOpen,
  onClose,
  title,
  rows,
  activeValues,
  onRowClick,
  rowIntent = 'toggle',
}) => {
  // The real distinct values (excluding the "(none)" and aggregated "Other" rows),
  // used for both the count and the copy-all payload.
  const realValues = rows
    .filter((r) => r.value !== NONE_VALUE && r.value !== OTHER_VALUE)
    .map((r) => r.label);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="md"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Done
        </Button>
      }
    >
      <div className="space-y-(--sp-rung)">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm text-neutral-600">
            All {realValues.length.toLocaleString()} values
            {!onRowClick
              ? '.'
              : rowIntent === 'navigate'
                ? '. Pick one to open the Members tab filtered by it.'
                : '. Click any value to filter the member list by it.'}
          </p>
          <CopyButton
            getText={() => realValues.join('\n')}
            label="Copy all"
            copiedLabel="Copied"
            disabled={realValues.length === 0}
            title="Copy every value, one per line"
          />
        </div>
        <ScrollableList maxHeight="50vh" fillAvailable={false}>
          <BreakdownReport
            rows={rows}
            activeValues={activeValues}
            onRowClick={onRowClick}
            rowIntent={rowIntent}
          />
        </ScrollableList>
      </div>
    </Modal>
  );
};

export default BreakdownDetailsModal;
