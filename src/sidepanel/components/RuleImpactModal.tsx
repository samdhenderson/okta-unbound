/**
 * @module sidepanel/components/RuleImpactModal
 * @description Read-only "what does this rule hold up?" preview for a group rule.
 *
 * Shows a rule's target groups with live member counts and, crucially, how many
 * members are held by this rule **alone** — nobody else's rule explains their
 * membership. Doubles as the confirmation gate for a deactivation: in
 * `deactivate` mode its footer commits the change. Computation is read-only —
 * see `shared/membership/ruleImpact`.
 *
 * **It used to call that population "lose access" in both modes, which was wrong
 * for the only verb it can perform (D-052).** Deactivating a rule removes
 * nobody: Okta keeps every existing membership and merely stops applying the
 * rule to new users, so the honest deactivate headline is that these members
 * stay put and become *unattributed*. Removal exists only on **delete**, where
 * `removeUsers` decides it and both branches are irreversible — stated here as
 * context because the panel does not offer delete. Per ADR-0036 the population
 * itself is still hedged: a manual add cannot always be told from a rule-placed
 * membership, which is what the closing footnote says.
 *
 * `TargetGroupRow`'s member-list disclosure is the shared `IconButton` (with a
 * real `aria-controls`), not a hand-rolled `<button>` — it used to be one, with
 * no `aria-controls` at all. Modal-body spacing consumes the `--sp-card`/
 * `--sp-rung` roles (ADR-0048) so the stack breathes with the panel's measured
 * width; each `TargetGroupRow` is itself a small card, so the gap between rows
 * is `--sp-rung` (card-to-card), not `--sp-inline`.
 */
import React, { useId, useState } from 'react';
import Modal from './shared/Modal';
import Button from './shared/Button';
import IconButton from './shared/IconButton';
import LoadingSpinner from './shared/LoadingSpinner';
import StatCard from './shared/StatCard';
import Icon from './shared/Icon';
import AlertMessage from './shared/AlertMessage';
import Eyebrow from './shared/Eyebrow';
import type { RuleImpactSummary, TargetGroupImpact } from '../../shared/membership/ruleImpact';
import type { RuleImpactMode, RuleImpactStatus, RuleImpactProgress } from '../hooks/useRuleImpact';
import { userDisplayName } from '../../shared/utils/userDisplay';

/** How many solely-held members to list per group before collapsing to a count. */
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
  /** Jump to a target group in the Groups tab (reverse of A2's rule deep-link). */
  onNavigateToGroup?: (groupId: string) => void;
}

/** One target-group row with an expandable list of members held by this rule alone. */
const TargetGroupRow: React.FC<{
  group: TargetGroupImpact;
  onNavigateToGroup?: (groupId: string) => void;
}> = ({ group, onNavigateToGroup }) => {
  const [expanded, setExpanded] = useState(false);
  const disclosureId = useId();
  const hasSoleHolds = group.heldSolelyCount > 0;
  const listed = group.heldSolelyByRule.slice(0, MAX_LISTED);
  const overflow = group.heldSolelyCount - listed.length;
  const sharePct =
    group.memberCount > 0 ? Math.round((group.heldSolelyCount / group.memberCount) * 100) : 0;

  const memberLine = (
    <>
      <p className="text-sm font-medium text-neutral-900 truncate">{group.groupName}</p>
      <p className="text-xs text-neutral-500">
        {group.memberCount.toLocaleString()} member{group.memberCount === 1 ? '' : 's'}
      </p>
    </>
  );

  return (
    <div
      className={`rounded-md border bg-white overflow-hidden ${
        hasSoleHolds ? 'border-warning-light' : 'border-neutral-200'
      }`}
    >
      <div className="flex items-center justify-between gap-3 px-(--sp-row-x) py-(--sp-row-y)">
        {/*
          Group name — deep-links to the Groups tab when navigation is wired.
          §3 exception — raw <button>: this is a name-plus-icon link, not a text
          CTA, so `Button`'s centred layout doesn't fit. `press-subtle`
          (ADR-0046) since it spans most of the row's width.
        */}
        {onNavigateToGroup ? (
          <button
            type="button"
            onClick={() => onNavigateToGroup(group.groupId)}
            title="View this group in the Groups tab"
            className="press press-subtle min-w-0 text-left hover:opacity-80"
          >
            <span className="flex items-center gap-1.5 min-w-0">
              <p className="text-sm font-medium text-neutral-900 truncate">{group.groupName}</p>
              <Icon type="chevron-right" size="xs" className="text-neutral-400 shrink-0" />
            </span>
            <p className="text-xs text-neutral-500">
              {group.memberCount.toLocaleString()} member{group.memberCount === 1 ? '' : 's'}
            </p>
          </button>
        ) : (
          <div className="min-w-0">{memberLine}</div>
        )}

        <div className="flex items-center gap-(--sp-inline) shrink-0">
          {hasSoleHolds ? (
            <span className="px-2 py-0.5 rounded-md bg-warning-light text-warning-text text-xs font-bold border border-warning-light">
              {group.heldSolelyCount.toLocaleString()} held by this rule alone
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-md bg-success-light text-success-text text-xs font-medium border border-success-light">
              No change
            </span>
          )}
          {hasSoleHolds && (
            <IconButton
              label={`${expanded ? 'Hide' : 'Show'} members held by this rule alone in ${group.groupName}`}
              variant="ghost"
              size="sm"
              expanded={expanded}
              controls={disclosureId}
              onClick={() => setExpanded((v) => !v)}
            >
              <Icon
                type="chevron-right"
                size="sm"
                className={`transition-transform duration-(--dur-instant) ${expanded ? 'rotate-90' : ''}`}
              />
            </IconButton>
          )}
        </div>
      </div>

      {/* Share bar: at-a-glance proportion of the roster this rule alone accounts for. */}
      {hasSoleHolds && (
        <div className="h-1 bg-neutral-100" title={`${sharePct}% of members`}>
          <div className="h-full bg-warning" style={{ width: `${sharePct}%` }} />
        </div>
      )}

      {hasSoleHolds && expanded && (
        <ul
          id={disclosureId}
          className="border-t border-neutral-100 divide-y divide-neutral-100 max-h-56 overflow-y-auto scrollable-list"
        >
          {listed.map((user) => (
            <li
              key={user.id}
              className="px-(--sp-row-x) py-(--sp-row-y) flex items-center justify-between gap-3"
            >
              <span className="text-sm text-neutral-800 truncate">{userDisplayName(user)}</span>
              <span className="text-xs text-neutral-400 font-mono truncate">
                {user.profile.email || user.profile.login}
              </span>
            </li>
          ))}
          {overflow > 0 && (
            <li className="px-(--sp-row-x) py-(--sp-row-y) text-xs text-neutral-500">
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
 * failure, and — on success — the count of members held by this rule alone plus
 * a per-target-group breakdown. The lead paragraph names the consequence of the
 * verb in play: on `deactivate`, that nobody is removed.
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
  onNavigateToGroup,
}) => {
  const isDeactivate = mode === 'deactivate';
  const totalHeldSolely = summary?.totalHeldSolely ?? 0;

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
      <div className="space-y-(--sp-card)">
        <p className="text-sm text-neutral-600">
          {isDeactivate ? 'Deactivating ' : 'Previewing '}
          <span className="font-semibold text-neutral-900">{ruleName}</span>
          {isDeactivate
            ? ' stops it placing new members. Nobody is removed from a group — Okta keeps existing memberships. The members below are held by this rule alone, so they would stay put with no rule left to explain their membership. Reactivating the rule restores it.'
            : ' — the members below appear to be held by this rule alone. Deactivating it removes nobody; they stay in the group, no longer explained by any rule. Only deleting the rule can remove them, and that choice is irreversible.'}
        </p>

        {status === 'loading' && (
          <div className="py-6">
            <LoadingSpinner
              size="xl"
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
          <AlertMessage
            message={{ text: error || 'Failed to analyze rule impact.', type: 'danger' }}
          />
        )}

        {status === 'done' && summary && (
          <>
            {/* Summary metrics — mirrors the Overview stat tiles for cohesion. */}
            <div className="grid grid-cols-2 gap-(--sp-rung)">
              <StatCard
                title="Held by this rule alone"
                value={totalHeldSolely}
                color={totalHeldSolely > 0 ? 'warning' : 'success'}
                icon={totalHeldSolely > 0 ? 'alert' : 'check'}
                subtitle={`across ${summary.targetGroups.length} target group${
                  summary.targetGroups.length === 1 ? '' : 's'
                }`}
              />
              <StatCard
                title="Current members"
                value={summary.distinctMemberCount}
                color="neutral"
                icon="users"
                subtitle="distinct, across targets"
              />
            </div>

            {/* D-047: totalHeldSolely === 0 reads the same whether this rule was
                checked against a real inventory of other rules or there was no
                inventory to check it against at all — call out which one this is. */}
            {totalHeldSolely === 0 &&
              (summary.emptyRuleInventory ? (
                <p className="text-sm text-neutral-500">
                  This org has no other group rules, so there was nothing to check this rule
                  against.
                </p>
              ) : (
                <p className="text-sm text-neutral-500">
                  Checked against every other group rule in the org — none collide with this one.
                </p>
              ))}

            {/* Per-group breakdown */}
            {summary.targetGroups.length > 0 ? (
              <div className="space-y-(--sp-rung)">
                <Eyebrow>Target groups</Eyebrow>
                {summary.targetGroups.map((group) => (
                  <TargetGroupRow
                    key={group.groupId}
                    group={group}
                    onNavigateToGroup={onNavigateToGroup}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-neutral-500">This rule has no target groups.</p>
            )}

            <p className="text-xs text-neutral-400">
              Attribution is inferred from rule targets and exclusions (the same attribution used
              across the app); members added manually cannot always be distinguished.
            </p>
          </>
        )}
      </div>
    </Modal>
  );
};

export default RuleImpactModal;
