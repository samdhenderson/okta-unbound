/**
 * @module sidepanel/components/ActivityBar
 * @description Container for the unified activity bar.
 *
 * Wires {@link useActivityBar} (the merge of scheduler state + operation progress
 * and the single Cancel path) to the pure {@link ActivityBarView}. This one bar
 * replaces the previously overlapping `SchedulerStatusBar` and `LoadingBar`.
 *
 * It also owns the collapse state. The bar is **condensed by default at every
 * width** and expands only when the reader asks for detail. It used to offer the
 * toggle only below 640px, on the reasoning that a wide panel has room for the
 * full row — but room is not the same as consent. The bar is docked chrome that
 * eats the bottom of the panel whatever the width, and the reader who has just
 * scrolled to the end of a list wants it out of the way, not merely fitting.
 * With the toggle unconditional there is no width at which the panel refuses to
 * give the space back, and no width-detection hook to keep in step with a
 * breakpoint.
 */
import React, { useState } from 'react';
import ActivityBarView from './ActivityBarView';
import { useActivityBar } from '../hooks/useActivityBar';

/**
 * Renders the fixed bottom activity bar and gates cancellation behind a confirm.
 */
const ActivityBar: React.FC = () => {
  const { view, cancel, cancelOperation } = useActivityBar();
  const [confirming, setConfirming] = useState(false);
  const [expanded, setExpanded] = useState(false);

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
      // No confirm: unlike "Cancel all", this stops exactly the operation its
      // label names, costs nothing but a re-run, and takes nothing else with it.
      onCancelOperation={cancelOperation}
      collapsed={!expanded}
      onToggleCollapse={() => setExpanded((prev) => !prev)}
    />
  );
};

export default ActivityBar;
