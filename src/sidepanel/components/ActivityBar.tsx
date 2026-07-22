/**
 * @module sidepanel/components/ActivityBar
 * @description Container for the unified activity bar.
 *
 * Wires {@link useActivityBar} (the merge of scheduler state + operation progress
 * and the single Cancel path) to the pure {@link ActivityBarView}. This one bar
 * replaces the previously overlapping `SchedulerStatusBar` and `LoadingBar`.
 *
 * It also owns the responsive collapse: on a narrow panel the full metric row
 * does not fit, so the bar condenses to status + rate + a processed/progress
 * tally and lets the user expand it on demand. Width detection lives in
 * {@link useIsNarrow}; the expanded/condensed choice is remembered here.
 */
import React, { useState } from 'react';
import ActivityBarView from './ActivityBarView';
import { useActivityBar } from '../hooks/useActivityBar';
import { useIsNarrow } from '../hooks/useIsNarrow';

/**
 * Below this panel width (CSS px) the full metric row starts to overflow, so the
 * bar offers its condensed layout. Sized to the point where the status region,
 * four metric slots and the Cancel action stop fitting on one comfortable line.
 */
const COMPACT_BELOW_PX = 640;

/**
 * Renders the fixed bottom activity bar and gates cancellation behind a confirm.
 */
const ActivityBar: React.FC = () => {
  const { view, cancel } = useActivityBar();
  const [confirming, setConfirming] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const isNarrow = useIsNarrow(COMPACT_BELOW_PX);

  // The toggle is only offered while the panel is narrow; a wide panel always
  // shows the full row. `collapsed` respects the user's manual expand override.
  const collapsible = isNarrow;
  const collapsed = isNarrow && !expanded;

  const handleCancel = () => {
    if (confirming) return;
    setConfirming(true);
    const pending = view.queueLength;
    const detail =
      pending > 0 ? ` and clear ${pending} pending request${pending === 1 ? '' : 's'}` : '';
    if (window.confirm(`Cancel the current operation${detail}?`)) {
      cancel();
    }
    setConfirming(false);
  };

  return (
    <ActivityBarView
      view={view}
      onCancel={handleCancel}
      collapsible={collapsible}
      collapsed={collapsed}
      onToggleCollapse={() => setExpanded((prev) => !prev)}
    />
  );
};

export default ActivityBar;
