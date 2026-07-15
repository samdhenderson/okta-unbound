/**
 * @module sidepanel/components/groups/GroupSourceModal
 * @description Read-only "why does this group exist?" detail for one group.
 *
 * Surfaces the safety context an admin needs before removing/merging a group:
 * the rules that feed it, the apps it is pushed to, and — on demand — the
 * manual-vs-rule split of its current membership. No mutations.
 */
import React from 'react';
import Modal from '../shared/Modal';
import Button from '../shared/Button';
import LoadingSpinner from '../shared/LoadingSpinner';
import StatCard from '../overview/shared/StatCard';
import type { GroupSummary } from '../../../shared/types';
import type { FeedingRule, SourceStatus } from '../../hooks/useGroupSource';
import type { MemberSourceBreakdown } from '../../../shared/membership/groupSource';

interface GroupSourceModalProps {
  /** The group being explained, or null when closed. */
  group: GroupSummary | null;
  /** Rules that assign users to the group. */
  feedingRules: FeedingRule[];
  /** Status of the feeding-rules load. */
  rulesStatus: SourceStatus;
  /** Manual-vs-rule breakdown once analyzed. */
  breakdown: MemberSourceBreakdown | null;
  /** Status of the gated member analysis. */
  memberStatus: SourceStatus;
  /** Error message for whichever step failed. */
  error: string | null;
  /** Close the modal. */
  onClose: () => void;
  /** Run the gated member-source analysis. */
  onAnalyzeMembers: () => void;
}

/** A small ACTIVE/INACTIVE status pill for a feeding rule. */
const RuleStatusPill: React.FC<{ status: string }> = ({ status }) => (
  <span
    className={`px-2 py-0.5 rounded-md text-xs font-medium border ${
      status === 'ACTIVE'
        ? 'bg-success-light text-success-text border-success-light'
        : 'bg-neutral-100 text-neutral-600 border-neutral-200'
    }`}
  >
    {status}
  </span>
);

/** Renders the read-only membership-source detail for a group. */
const GroupSourceModal: React.FC<GroupSourceModalProps> = ({
  group,
  feedingRules,
  rulesStatus,
  breakdown,
  memberStatus,
  error,
  onClose,
  onAnalyzeMembers,
}) => {
  const pushMappings = group?.pushMappings ?? [];

  return (
    <Modal
      isOpen={group !== null}
      onClose={onClose}
      title="Membership source"
      size="lg"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      {group && (
        <div className="space-y-5">
          <p className="text-sm text-neutral-600">
            Why does <span className="font-semibold text-neutral-900">{group.name}</span> exist and
            who feeds it?
          </p>

          {/* Feeding rules */}
          <section>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-2">
              Feeding rules
            </h4>
            {rulesStatus === 'loading' ? (
              <LoadingSpinner size="sm" message="Loading rules…" centered />
            ) : rulesStatus === 'error' ? (
              <p className="text-sm text-danger-text">{error || 'Failed to load rules.'}</p>
            ) : feedingRules.length === 0 ? (
              <p className="text-sm text-neutral-500">
                No group rules assign users to this group — its members are added manually or via
                app push.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {feedingRules.map((rule) => (
                  <li
                    key={rule.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-neutral-200 px-3 py-2"
                  >
                    <span className="text-sm text-neutral-900 truncate">{rule.name}</span>
                    <RuleStatusPill status={rule.status} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* App push */}
          <section>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-2">
              App push
            </h4>
            {pushMappings.length === 0 ? (
              <p className="text-sm text-neutral-500">Not pushed to any application.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {[...new Set(pushMappings.map((m) => m.appName || m.appId))].map((app) => (
                  <span
                    key={app}
                    className="px-2 py-0.5 rounded-md text-xs font-medium bg-primary-light text-primary-text border border-primary-highlight"
                  >
                    {app}
                  </span>
                ))}
              </div>
            )}
          </section>

          {/* Member source breakdown (gated) */}
          <section>
            <div className="flex items-center justify-between gap-3 mb-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-600">
                Membership breakdown
              </h4>
              {memberStatus === 'idle' && (
                <Button
                  variant="secondary"
                  size="sm"
                  icon="users"
                  onClick={onAnalyzeMembers}
                  disabled={group.memberCount === 0}
                >
                  Analyze {group.memberCount.toLocaleString()} member
                  {group.memberCount === 1 ? '' : 's'}
                </Button>
              )}
            </div>

            {memberStatus === 'idle' && (
              <p className="text-sm text-neutral-500">
                Split current members into manual vs rule-managed (one paginated read).
              </p>
            )}
            {memberStatus === 'loading' && (
              <LoadingSpinner size="sm" message="Analyzing members…" centered />
            )}
            {memberStatus === 'error' && (
              <p className="text-sm text-danger-text">{error || 'Failed to analyze members.'}</p>
            )}
            {memberStatus === 'done' && breakdown && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <StatCard title="Manual" value={breakdown.direct} color="neutral" icon="hand" />
                  <StatCard
                    title="Rule-managed"
                    value={breakdown.ruleBased}
                    color="primary"
                    icon="bolt"
                  />
                </div>
                {breakdown.byRule.length > 0 && (
                  <ul className="space-y-1.5">
                    {breakdown.byRule.map((r) => (
                      <li
                        key={r.ruleId}
                        className="flex items-center justify-between gap-3 rounded-md border border-neutral-200 px-3 py-2"
                      >
                        <span className="text-sm text-neutral-900 truncate">{r.ruleName}</span>
                        <span className="text-xs font-semibold text-neutral-600">
                          {r.count.toLocaleString()} member{r.count === 1 ? '' : 's'}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </Modal>
  );
};

export default GroupSourceModal;
