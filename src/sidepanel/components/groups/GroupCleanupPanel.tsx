/**
 * @module sidepanel/components/groups/GroupCleanupPanel
 * @description Read-only directory-clutter triage panel for the Groups tab.
 *
 * Runs the local {@link analyzeClutter} classifier over the already-loaded group
 * list and surfaces the triage categories (empty, duplicate-name, stale) as
 * one-click selectors that feed the existing selection → bulk/export machinery,
 * plus a ranked preview of the most review-worthy groups. No API calls and no
 * mutations of its own — it only helps the admin decide what to look at.
 */
import React, { useMemo } from 'react';
import Button from '../shared/Button';
import EmptyState from '../shared/EmptyState';
import StatCard from '../overview/shared/StatCard';
import type { GroupSummary } from '../../../shared/types';
import { analyzeClutter } from './clutterAnalysis';

/** How many flagged groups to preview before collapsing to a count. */
const MAX_PREVIEW = 8;

/** Grade a fused review score into the app's severity token set. */
function reviewScoreColor(score: number): string {
  if (score >= 70) return 'bg-danger-light text-danger-text border-danger-light';
  if (score >= 40) return 'bg-warning-light text-warning-text border-warning-light';
  return 'bg-neutral-100 text-neutral-600 border-neutral-200';
}

interface GroupCleanupPanelProps {
  /** The loaded (cached) groups to analyze. */
  groups: GroupSummary[];
  /** Replace the current selection with the given group ids. */
  onSelectGroups: (ids: string[]) => void;
  /** Close the panel. */
  onClose: () => void;
}

/**
 * Renders the clutter-triage summary: category selectors plus a ranked preview of
 * the groups most worth reviewing. Selecting a category hands its ids to the
 * Groups tab's selection so the admin can act via the existing bulk/export tools.
 */
const GroupCleanupPanel: React.FC<GroupCleanupPanelProps> = ({
  groups,
  onSelectGroups,
  onClose,
}) => {
  const report = useMemo(() => analyzeClutter(groups), [groups]);
  const preview = report.entries.slice(0, MAX_PREVIEW);
  const overflow = report.entries.length - preview.length;

  return (
    <div className="bg-white rounded-md border border-neutral-200 p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900">Cleanup triage</h3>
          <p className="text-xs text-neutral-500">
            {report.flaggedIds.length} of {report.totalGroups} loaded groups worth a review — local
            analysis, no API calls.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>

      {report.flaggedIds.length === 0 ? (
        <EmptyState
          icon="check"
          title="No clutter detected"
          description="No empty, duplicate-named, or stale groups in the loaded list."
        />
      ) : (
        <>
          {/* Category tiles double as selectors — mirrors the Overview stat grid. */}
          <div className="grid grid-cols-3 gap-3">
            <StatCard
              title="Empty"
              value={report.categories.empty.length}
              color="neutral"
              icon="minus"
              subtitle="no members"
              onClick={
                report.categories.empty.length > 0
                  ? () => onSelectGroups(report.categories.empty)
                  : undefined
              }
            />
            <StatCard
              title="Duplicate names"
              value={report.categories.duplicateName.length}
              color="warning"
              icon="clipboard"
              subtitle="shared name"
              onClick={
                report.categories.duplicateName.length > 0
                  ? () => onSelectGroups(report.categories.duplicateName)
                  : undefined
              }
            />
            <StatCard
              title="Stale"
              value={report.categories.stale.length}
              color="warning"
              icon="pause"
              subtitle="no recent activity"
              onClick={
                report.categories.stale.length > 0
                  ? () => onSelectGroups(report.categories.stale)
                  : undefined
              }
            />
          </div>

          <div className="flex justify-end">
            <Button
              variant="primary"
              size="sm"
              onClick={() => onSelectGroups(report.flaggedIds)}
              title="Select every flagged group"
            >
              Select all flagged ({report.flaggedIds.length})
            </Button>
          </div>

          {/* Ranked preview of the most review-worthy groups */}
          <div className="space-y-2">
            {preview.map((entry) => (
              <div
                key={entry.group.id}
                className="flex items-center justify-between gap-3 rounded-md border border-neutral-200 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-neutral-900 truncate">
                    {entry.group.name}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {entry.reasons.map((reason) => (
                      <span
                        key={reason}
                        className="px-2 py-0.5 rounded-md bg-neutral-50 text-neutral-600 text-xs font-medium border border-neutral-200"
                      >
                        {reason}
                      </span>
                    ))}
                  </div>
                </div>
                <span
                  className={`shrink-0 px-2 py-0.5 rounded-md text-xs font-bold border ${reviewScoreColor(
                    entry.reviewScore,
                  )}`}
                  title="Review confidence (fused signal, 0–100)"
                >
                  {entry.reviewScore}
                </span>
              </div>
            ))}
            {overflow > 0 && (
              <p className="text-xs text-neutral-500">
                and {overflow} more flagged group{overflow === 1 ? '' : 's'}…
              </p>
            )}
          </div>

          <p className="text-xs text-neutral-400">
            Detection is local over the loaded list (member counts, names, staleness). It does not
            infer rule-orphan status. Nothing here deletes a group — selecting a category lets you
            review or act on it with the existing tools.
          </p>
        </>
      )}
    </div>
  );
};

export default GroupCleanupPanel;
