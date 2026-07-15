/**
 * @module sidepanel/components/RuleImpactModal
 * @description Read-only "who loses access?" preview for a group rule.
 *
 * Shows a rule's target groups with live member counts and, crucially, how many
 * members would lose access if the rule were deactivated (the members held by
 * this rule alone). Doubles as the confirmation gate for a deactivation: in
 * `deactivate` mode it leads with the loss headline and its footer commits the
 * change. Computation is read-only — see `shared/membership/ruleImpact`.
 */
import React, { useState } from 'react';
import Modal from './shared/Modal';
import Button from './shared/Button';
import LoadingSpinner from './shared/LoadingSpinner';
import type { RuleImpactSummary, TargetGroupImpact } from '../../shared/membership/ruleImpact';
import type { RuleImpactMode, RuleImpactStatus, RuleImpactProgress } from '../hooks/useRuleImpact';
import { userDisplayName } from '../../shared/utils/userDisplay';

/** How many losing members to list per group before collapsing to a count. */
const MAX_LISTED = 50;

interface RuleImpactModalProps {
  /** Whether the modal is shown. */
  isOpen: boolean;
  /** The rule name being analyzed (for the header/copy). */
  ruleName: string;
  /** Preview vs deactivation-confirmation intent. */
  mode: RuleImpactMode;
  /** Async status of the capture. */
  status: RuleImpactStatus;
  /** The captured summary once available. */
  summary: RuleImpactSummary | null;
  /** Error message when `status === 'error'`. */
  error: string | null;
  /** Load progress while capturing. */
  progress: RuleImpactProgress | null;
  /** Close/cancel the modal. */
  onClose: () => void;
  /** Commit the deactivation (only used in `deactivate` mode). */
  onConfirmDeactivate?: () => void;
}

/** One target-group row with an expandable list of members who would lose access. */
const TargetGroupRow: React.FC<{ group: TargetGroupImpact }> = ({ group }) => {
  const [expanded, setExpanded] = useState(false);
  const hasLoss = group.losingCount > 0;
  const listed = group.losing.slice(0, MAX_LISTED);
  const overflow = group.losingCount - listed.length;

  return (
    <div className="rounded-md border border-neutral-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => hasLoss && setExpanded((v) => !v)}
        className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left ${
          hasLoss ? 'cursor-pointer hover:bg-neutral-50' : 'cursor-default'
        }`}
        aria-expanded={hasLoss ? expanded : undefined}
      >
        <div className="min-w-0">
          <p className="text-sm font-medium text-neutral-900 truncate">{group.groupName}</p>
          <p className="text-xs text-neutral-500">
            {group.memberCount.toLocaleString()} member{group.memberCount === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {hasLoss ? (
            <span className="px-2 py-0.5 rounded-md bg-danger-light text-danger-text text-xs font-bold border border-danger-light">
              {group.losingCount.toLocaleString()} lose access
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-md bg-success-light text-success-text text-xs font-medium border border-success-light">
              No change
            </span>
          )}
          {hasLoss && (
            <svg
              className={`w-4 h-4 text-neutral-400 transition-transform duration-100 ${expanded ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          )}
        </div>
      </button>

      {hasLoss && expanded && (
        <ul className="border-t border-neutral-100 divide-y divide-neutral-100 max-h-56 overflow-y-auto scrollable-list">
          {listed.map((user) => (
            <li key={user.id} className="px-3 py-2 flex items-center justify-between gap-3">
              <span className="text-sm text-neutral-800 truncate">{userDisplayName(user)}</span>
              <span className="text-xs text-neutral-400 font-mono truncate">
                {user.profile.email || user.profile.login}
              </span>
            </li>
          ))}
          {overflow > 0 && (
            <li className="px-3 py-2 text-xs text-neutral-500">
              and {overflow.toLocaleString()} more…
            </li>
          )}
        </ul>
      )}
    </div>
  );
};

/**
 * Renders the rule-impact preview / deactivation-confirmation modal.
 *
 * Shows a loading state while target-group members load, an error state on
 * failure, and — on success — a loss headline plus a per-target-group breakdown.
 */
const RuleImpactModal: React.FC<RuleImpactModalProps> = ({
  isOpen,
  ruleName,
  mode,
  status,
  summary,
  error,
  progress,
  onClose,
  onConfirmDeactivate,
}) => {
  const isDeactivate = mode === 'deactivate';
  const totalLosing = summary?.totalLosing ?? 0;

  const footer = (
    <>
      <Button variant="secondary" onClick={onClose}>
        {isDeactivate ? 'Cancel' : 'Close'}
      </Button>
      {isDeactivate && (
        <Button
          variant="danger"
          onClick={onConfirmDeactivate}
          disabled={status === 'loading'}
          title={status === 'loading' ? 'Wait for the impact analysis to finish' : undefined}
        >
          Deactivate rule
        </Button>
      )}
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isDeactivate ? 'Deactivate rule?' : 'Rule impact preview'}
      size="lg"
      footer={footer}
    >
      <div className="space-y-4">
        <p className="text-sm text-neutral-600">
          {isDeactivate ? 'Deactivating ' : 'Previewing '}
          <span className="font-semibold text-neutral-900">{ruleName}</span>
          {isDeactivate
            ? ' removes its assignments. Members below are held by this rule alone and would lose access.'
            : ' — members held by this rule alone would lose access if it were deactivated.'}
        </p>

        {status === 'loading' && (
          <div className="py-6">
            <LoadingSpinner
              size="md"
              centered
              message={progress ? progress.message : 'Analyzing rule impact…'}
            />
            {progress && progress.total > 0 && (
              <p className="mt-2 text-center text-xs text-neutral-500">
                Group {progress.current} of {progress.total}
              </p>
            )}
          </div>
        )}

        {status === 'error' && (
          <div className="rounded-md border border-danger-light bg-danger-light p-3">
            <p className="text-sm text-danger-text">{error || 'Failed to analyze rule impact.'}</p>
          </div>
        )}

        {status === 'done' && summary && (
          <>
            {/* Headline */}
            <div
              className={`rounded-md border p-3 ${
                totalLosing > 0
                  ? 'border-danger-light bg-danger-light'
                  : 'border-success-light bg-success-light'
              }`}
            >
              <p
                className={`text-sm font-semibold ${
                  totalLosing > 0 ? 'text-danger-text' : 'text-success-text'
                }`}
              >
                {totalLosing > 0
                  ? `${totalLosing.toLocaleString()} user${totalLosing === 1 ? '' : 's'} would lose access`
                  : 'No users would lose access'}
              </p>
              <p className="text-xs text-neutral-600 mt-0.5">
                Across {summary.targetGroups.length} target group
                {summary.targetGroups.length === 1 ? '' : 's'} ·{' '}
                {summary.distinctMemberCount.toLocaleString()} distinct current member
                {summary.distinctMemberCount === 1 ? '' : 's'}
              </p>
            </div>

            {/* Per-group breakdown */}
            {summary.targetGroups.length > 0 ? (
              <div className="space-y-2">
                {summary.targetGroups.map((group) => (
                  <TargetGroupRow key={group.groupId} group={group} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-neutral-500">This rule has no target groups.</p>
            )}

            <p className="text-xs text-neutral-400">
              Loss is inferred from rule targets and exclusions (the same attribution used across
              the app); members added manually cannot always be distinguished.
            </p>
          </>
        )}
      </div>
    </Modal>
  );
};

export default RuleImpactModal;
