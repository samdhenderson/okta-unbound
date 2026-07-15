/**
 * @module sidepanel/components/groups/GroupMergeModal
 * @description Wizard to consolidate (merge) 2+ selected groups.
 *
 * Choose a survivor → preview the member delta and "what breaks" (feeding rules /
 * app push on the sources) → confirm → copy source members into the survivor and
 * empty the sources. Emptying is blocked when a source is fed by an active rule.
 * Every run is audited and recorded for undo; group deletion is intentionally not
 * performed (the emptied husks are left for the admin to delete in Okta).
 */
import React, { useMemo, useState } from 'react';
import Modal from '../shared/Modal';
import Button from '../shared/Button';
import LoadingSpinner from '../shared/LoadingSpinner';
import StatCard from '../overview/shared/StatCard';
import type { GroupSummary } from '../../../shared/types';
import type { MergePhase, MergeResults } from '../../hooks/useGroupMerge';
import type { MergePlan } from '../../../shared/membership/mergePlan';

interface GroupMergeModalProps {
  isOpen: boolean;
  /** The 2+ groups selected for merge. */
  selectedGroups: GroupSummary[];
  phase: MergePhase;
  plan: MergePlan | null;
  results: MergeResults | null;
  error: string | null;
  /** Load the preview for the chosen survivor + the remaining sources. */
  onPreview: (survivor: GroupSummary, sources: GroupSummary[]) => void;
  /** Execute the previewed plan. */
  onExecute: () => void;
  /** Close + reset. */
  onClose: () => void;
}

/** Renders the merge wizard across its select → preview → running → done phases. */
const GroupMergeModal: React.FC<GroupMergeModalProps> = ({
  isOpen,
  selectedGroups,
  phase,
  plan,
  results,
  error,
  onPreview,
  onExecute,
  onClose,
}) => {
  // The user's pick, or (default/fallback) the largest group — derived, no effect,
  // so a changed selection can't leave a stale survivor selected.
  const [picked, setPicked] = useState<string | null>(null);
  const largestId = useMemo(
    () => [...selectedGroups].sort((a, b) => b.memberCount - a.memberCount)[0]?.id,
    [selectedGroups],
  );
  const survivorId = picked && selectedGroups.some((g) => g.id === picked) ? picked : largestId;

  const survivor = selectedGroups.find((g) => g.id === survivorId);
  const sources = selectedGroups.filter((g) => g.id !== survivorId);
  const showSelect = phase === 'idle' || phase === 'preview-loading';

  const footer =
    phase === 'preview' && plan ? (
      <>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" onClick={onExecute} disabled={plan.blocked}>
          Merge {plan.sources.length} group{plan.sources.length === 1 ? '' : 's'}
        </Button>
      </>
    ) : phase === 'done' || phase === 'error' ? (
      <Button variant="secondary" onClick={onClose}>
        Close
      </Button>
    ) : showSelect ? (
      <>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={() => survivor && onPreview(survivor, sources)}
          disabled={!survivor || sources.length === 0 || phase === 'preview-loading'}
          loading={phase === 'preview-loading'}
        >
          Preview merge
        </Button>
      </>
    ) : undefined;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Merge groups" size="lg" footer={footer}>
      {/* Step 1 — choose survivor */}
      {showSelect && (
        <div className="space-y-3">
          <p className="text-sm text-neutral-600">
            Members of the other groups are copied into the <strong>survivor</strong>, then those
            groups are emptied. Nothing is deleted — delete the emptied groups in Okta afterward.
          </p>
          <div className="text-xs font-semibold uppercase tracking-wider text-neutral-600">
            Survivor
          </div>
          <div className="space-y-2" role="radiogroup" aria-label="Choose the survivor group">
            {selectedGroups.map((g) => (
              <button
                key={g.id}
                type="button"
                role="radio"
                aria-checked={survivorId === g.id}
                onClick={() => setPicked(g.id)}
                className={`w-full flex items-center justify-between gap-3 rounded-md border px-3 py-2.5 text-left transition-colors ${
                  survivorId === g.id
                    ? 'border-primary bg-primary-light'
                    : 'border-neutral-200 bg-white hover:border-neutral-400'
                }`}
              >
                <span className="text-sm font-medium text-neutral-900 truncate">{g.name}</span>
                <span className="text-xs text-neutral-500 shrink-0">
                  {g.memberCount.toLocaleString()} members
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2 — preview */}
      {phase === 'preview' && plan && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              title="Members to copy"
              value={plan.totalCopies}
              color="primary"
              icon="plus"
            />
            <StatCard
              title="Members to remove"
              value={plan.totalRemovals}
              color="neutral"
              icon="minus"
            />
          </div>

          <p className="text-sm text-neutral-600">
            <strong>{plan.totalCopies.toLocaleString()}</strong> distinct member
            {plan.totalCopies === 1 ? '' : 's'} will be copied into{' '}
            <strong>{plan.survivor.name}</strong>, then these groups will be emptied:
          </p>

          <ul className="space-y-2">
            {plan.sources.map((s) => (
              <li
                key={s.id}
                className={`rounded-md border px-3 py-2 ${
                  s.hasActiveFeedingRule
                    ? 'border-danger-light bg-danger-light'
                    : 'border-neutral-200'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-neutral-900 truncate">{s.name}</span>
                  <span className="text-xs text-neutral-500 shrink-0">
                    {s.membersToRemove.length.toLocaleString()} members
                  </span>
                </div>
                {s.hasActiveFeedingRule && (
                  <p className="mt-1 text-xs text-danger-text">
                    Fed by active rule{s.feedingRuleNames.length === 1 ? '' : 's'}:{' '}
                    {s.feedingRuleNames.join(', ')} — emptying would be undone by the rule. Repoint
                    or deactivate it first.
                  </p>
                )}
              </li>
            ))}
          </ul>

          {plan.blocked ? (
            <p className="text-sm font-medium text-danger-text">
              This merge is blocked: at least one source is fed by an active rule.
            </p>
          ) : (
            <p className="text-xs text-neutral-400">
              This is reversible from the History tab (each affected group gets an undo entry).
            </p>
          )}
        </div>
      )}

      {/* Step 3 — running */}
      {phase === 'running' && (
        <LoadingSpinner size="md" centered message="Merging… see the progress bar below." />
      )}

      {/* Step 4 — done / error */}
      {(phase === 'done' || phase === 'error') && results && (
        <div className="space-y-3">
          {phase === 'error' && (
            <p className="text-sm text-danger-text">{error || 'The merge did not complete.'}</p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <StatCard title="Copied" value={results.copied} color="success" icon="check" />
            <StatCard title="Emptied" value={results.removed} color="neutral" icon="minus" />
          </div>
          {(results.copyFailed > 0 || results.removeFailed > 0) && (
            <p className="text-sm text-warning-text">
              {results.copyFailed + results.removeFailed} operation
              {results.copyFailed + results.removeFailed === 1 ? '' : 's'} failed.
            </p>
          )}
          <p className="text-xs text-neutral-400">
            The emptied groups still exist — delete them in Okta if you no longer need them.
          </p>
        </div>
      )}
    </Modal>
  );
};

export default GroupMergeModal;
