/**
 * @module sidepanel/components/export/ExportFilterBox
 * @description Raw filter input for the Export tab with a debounced live match-count.
 *
 * Wraps the shared {@link Input} with the descriptor's inline `help` text and a
 * live "N matching" readout driven by the tab hook's debounced
 * {@link module:sidepanel/hooks/useExportTab.ExportMatchCount} probe. Presentational
 * only — the filter text and match-count are owned by the hook.
 */
import React from 'react';
import { Input } from '../shared';
import type { ExportMatchCount } from '../../hooks/useExportTab';

/** Props for {@link ExportFilterBox}. */
interface ExportFilterBoxProps {
  /** Controlled raw filter expression. */
  value: string;
  /** Called with the new filter text on each change. */
  onChange: (value: string) => void;
  /** Inline help text shown under the field (from the descriptor). */
  help: string;
  /** Example expression shown as the input placeholder. */
  placeholder: string;
  /** Debounced first-page match-count, or `null` while unknown. */
  matchCount: ExportMatchCount | null;
  /** Whether a match-count probe is in flight. */
  matchCountLoading: boolean;
  /** Disable the input (e.g. no context entity chosen yet). */
  disabled?: boolean;
}

/** Render the live match-count line beneath the filter input. */
const MatchCountLine: React.FC<{
  loading: boolean;
  matchCount: ExportMatchCount | null;
}> = ({ loading, matchCount }) => {
  if (loading) {
    return <span className="text-xs text-neutral-500">Checking…</span>;
  }
  if (!matchCount) return null;
  if (matchCount.count === 0) {
    return <span className="text-xs font-medium text-warning-text">No matches</span>;
  }
  return (
    <span className="text-xs font-medium text-neutral-700">
      {matchCount.count}
      {matchCount.hasMore ? '+' : ''} matching
    </span>
  );
};

/**
 * The Export tab's raw filter box: a labelled input, its help text, and a live
 * match-count readout.
 */
const ExportFilterBox: React.FC<ExportFilterBoxProps> = ({
  value,
  onChange,
  help,
  placeholder,
  matchCount,
  matchCountLoading,
  disabled = false,
}) => {
  return (
    <div className="space-y-1.5">
      <Input
        label="Filter"
        type="search"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        hint={help}
        disabled={disabled}
      />
      <div className="min-h-4">
        <MatchCountLine loading={matchCountLoading} matchCount={matchCount} />
      </div>
    </div>
  );
};

export default ExportFilterBox;
