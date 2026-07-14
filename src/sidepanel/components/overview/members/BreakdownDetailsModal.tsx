import React from 'react';
import Modal from '../../shared/Modal';
import Button from '../../shared/Button';
import CopyButton from '../../shared/CopyButton';
import ScrollableList from '../../shared/ScrollableList';
import BreakdownReport from './BreakdownReport';
import { type BreakdownRow, NONE_VALUE, OTHER_VALUE } from './memberAnalytics';

interface BreakdownDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  /** The complete (un-aggregated) value distribution for the dimension. */
  rows: BreakdownRow[];
  activeValues: Set<string>;
  onRowClick: (row: BreakdownRow) => void;
}

/**
 * Shows the full value distribution for a composition dimension — including the
 * values that were collapsed into the "Other" row — in a scrollable modal.
 * Each value is clickable to toggle it as a filter.
 */
const BreakdownDetailsModal: React.FC<BreakdownDetailsModalProps> = ({
  isOpen,
  onClose,
  title,
  rows,
  activeValues,
  onRowClick,
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
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm text-neutral-600">
            All {realValues.length.toLocaleString()} values. Click any value to filter the member
            list by it.
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
          <BreakdownReport rows={rows} activeValues={activeValues} onRowClick={onRowClick} />
        </ScrollableList>
      </div>
    </Modal>
  );
};

export default BreakdownDetailsModal;
