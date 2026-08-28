/**
 * @module sidepanel/components/groups/detail/GroupOverviewPane
 * @description The Group Detail view's landing pane: verdict tiles, each a
 * derived claim, that drill into the tab that answers it.
 *
 * Presentational and read-only: every figure here is a re-read of state
 * {@link GroupDetailView} already computes via
 * {@link sidepanel/hooks/useGroupSource.useGroupSource},
 * {@link sidepanel/hooks/useGroupRuleReferences.useGroupRuleReferences} and
 * {@link sidepanel/hooks/useGroupAccessGrants.useGroupAccessGrants} — this pane
 * issues no fetch of its own.
 *
 * Two rules this pane exists to enforce (see the Group Detail rework plan and
 * `designDocs/Groups Tab Rework/README.md`):
 *
 * - **A tile never restates a fact `PageHeader` already carries** — name, id,
 *   member count, rule count and timestamps live there (ADR-0032). Every tile
 *   headline is a *derived* claim ("83% of members come from 4 rules"), never
 *   a bare count already on the header.
 * - **A fact that hasn't loaded is omitted, never rendered as a zero or a
 *   dash.** Membership source (see {@link GroupMembersSection}) may
 *   still be genuinely `'idle'` — a group over `GroupDetailView`'s
 *   `AUTO_LOAD_MEMBER_CAP`, or no Okta tab connected — in which case its tile
 *   is the one call-to-action on this pane, never a number. Once the analysis
 *   is under way (`'loading'`) or has failed (`'error'`), the tile renders
 *   nothing rather than inviting a click on work that's already running or
 *   already failed. Access grants and rule counts load automatically (not
 *   user-gated) and follow the same "absent until resolved" rule for the same
 *   reason — there is nothing for a reader to press before then, so a
 *   call-to-action would be false invitation. The app-push tile follows the
 *   same "never a zero-card" rule as {@link GroupPushSection}: rendered only
 *   when the group carries at least one mapping.
 *
 * Every tile is a real `<button>` — the whole tile is the drill-in target,
 * not a card with a link buried inside — routing through `onNavigate` to the
 * tab that answers the claim.
 */
import React from 'react';
import Icon, { type IconType } from '../../shared/Icon';
import type { SourceStatus } from '../../../hooks/useGroupSource';
import type { RolesReadStatus } from '../../../hooks/useGroupAccessGrants';
import type { MemberSourceBreakdown } from '../../../../shared/membership/groupSource';
import type { GroupSummary } from '../../../../shared/types';

/** The three tabbed panes a tile can drill into. */
type OverviewTarget = 'members' | 'access' | 'rules';

/** Props for {@link GroupOverviewPane}. */
interface GroupOverviewPaneProps {
  /** The group being described. Only `pushMappings` is read here — every other
   * identity fact lives in `PageHeader` per ADR-0032. */
  group: GroupSummary;
  /** The manual-vs-rule membership split, once the gated analysis has run —
   * the same data {@link GroupMembersSection}'s source strip renders. */
  breakdown: MemberSourceBreakdown | null;
  /** Status of the gated member-source analysis. */
  memberStatus: SourceStatus;
  /** Number of rules that assign into this group ({@link useGroupSource}'s `feedingRules`). */
  feedingRulesCount: number;
  /** Status of the feeding-rules load. */
  rulesStatus: SourceStatus;
  /** Number of apps this group is assigned to. */
  appsCount: number;
  /** Status of the app-assignment read. */
  appsStatus: SourceStatus;
  /** Number of admin roles this group grants. Only meaningful when `rolesStatus === 'available'`. */
  rolesCount: number;
  /** Whether the admin-roles read could be completed — see {@link RolesReadStatus}. */
  rolesStatus: RolesReadStatus;
  /** Number of rules that reference this group in a condition expression. */
  referencingRulesCount: number;
  /** Status of the referencing-rules load. */
  referencingStatus: SourceStatus;
  /** Switches the Group Detail view's active tab — the same setter its `Tabs` uses. */
  onNavigate: (tab: OverviewTarget) => void;
}

/** Pluralizes a count-noun pair the way every tile's copy needs it. */
function plural(count: number, noun: string): string {
  return `${count.toLocaleString()} ${noun}${count === 1 ? '' : 's'}`;
}

/** Props for the private {@link VerdictTile}. */
interface VerdictTileProps {
  /** Uppercase label naming what the tile is about. */
  label: string;
  /** Leading glyph. */
  icon: IconType;
  /** The derived-claim headline — never a bare fact already on `PageHeader`. */
  headline: string;
  /** An optional second line of supporting detail. */
  detail?: string;
  /** Which tab this tile drills into. */
  onClick: () => void;
}

/**
 * One clickable verdict tile: an uppercase label, a derived-claim headline,
 * optional supporting detail, and a chevron affordance. A real `<button>` so
 * the entire tile — not a link inside it — is the drill-in target, matching
 * the design doc's restrained chrome (1px border, no shadow).
 */
const VerdictTile: React.FC<VerdictTileProps> = ({ label, icon, headline, detail, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex w-full items-start gap-3 rounded-md border border-neutral-200 bg-white p-3 text-left transition-colors duration-(--dur-instant) ease-standard hover:border-neutral-300"
  >
    <span className="mt-0.5 shrink-0 rounded-md bg-neutral-100 p-1.5">
      <Icon type={icon} size="sm" className="text-neutral-600" />
    </span>
    <span className="min-w-0 flex-1">
      <span className="block text-xs font-semibold uppercase tracking-wide text-neutral-600">
        {label}
      </span>
      <span className="mt-1 block text-sm font-medium text-neutral-900">{headline}</span>
      {detail && <span className="mt-0.5 block text-xs text-neutral-500">{detail}</span>}
    </span>
    <Icon type="chevron-right" size="sm" className="mt-0.5 shrink-0 text-neutral-400" />
  </button>
);

/**
 * The "where membership comes from" tile: a call-to-action while genuinely
 * `'idle'`, absent while `'loading'`/`'error'`, a derived split once `'done'`.
 * Never renders a percentage or count it does not actually have.
 */
const MembershipSourceTile: React.FC<{
  breakdown: MemberSourceBreakdown | null;
  memberStatus: SourceStatus;
  onClick: () => void;
}> = ({ breakdown, memberStatus, onClick }) => {
  // `idle` is the only status genuinely inviting a click — an over-cap group,
  // or no Okta tab connected. `loading`/`error` render nothing, exactly like
  // `AccessGrantsTile`/`RuleRelationshipsTile` below: a typical group's
  // analysis now auto-fires on open (see `GroupDetailView`'s
  // `AUTO_LOAD_MEMBER_CAP`), so showing this CTA for `loading` would invite a
  // click on an analysis already running in the background.
  if (memberStatus === 'idle') {
    return (
      <VerdictTile
        label="Where membership comes from"
        icon="users"
        headline="Not analyzed yet"
        detail="Open Members to split the roster into rule-managed and manual."
        onClick={onClick}
      />
    );
  }
  if (memberStatus !== 'done' || !breakdown || breakdown.total === 0) return null;

  const ruleCount = breakdown.byRule.length;
  const pct = Math.round((breakdown.ruleBased / breakdown.total) * 100);
  const headline =
    breakdown.ruleBased === 0
      ? 'All members were added by hand'
      : `${plural(ruleCount, 'rule')} account for ${pct}% of members`;
  const detail =
    breakdown.direct > 0
      ? `${plural(breakdown.direct, 'member')} added by hand`
      : breakdown.ruleBased > 0
        ? 'No members were added by hand'
        : undefined;

  return (
    <VerdictTile
      label="Where membership comes from"
      icon="users"
      headline={headline}
      detail={detail}
      onClick={onClick}
    />
  );
};

/**
 * The "what it grants" tile — apps first (loads automatically, no gate), an
 * admin-role count added only once that read has actually resolved to a
 * confirmed list (`rolesStatus === 'available'`). Absent entirely until the
 * app-assignment read completes; there is no gate to invite a click through.
 */
const AccessGrantsTile: React.FC<{
  appsCount: number;
  appsStatus: SourceStatus;
  rolesCount: number;
  rolesStatus: RolesReadStatus;
  onClick: () => void;
}> = ({ appsCount, appsStatus, rolesCount, rolesStatus, onClick }) => {
  if (appsStatus !== 'done') return null;

  return (
    <VerdictTile
      label="What it grants"
      icon="shield"
      headline={`Grants access to ${plural(appsCount, 'app')}`}
      detail={rolesStatus === 'available' ? `${plural(rolesCount, 'admin role')}` : undefined}
      onClick={onClick}
    />
  );
};

/**
 * The "why, and who reads it" tile — assigning-rule count first (loads
 * automatically), referencing-rule count appended only once that second,
 * independent read has resolved. Absent until the assigning-rule count is
 * known.
 */
const RuleRelationshipsTile: React.FC<{
  feedingRulesCount: number;
  rulesStatus: SourceStatus;
  referencingRulesCount: number;
  referencingStatus: SourceStatus;
  onClick: () => void;
}> = ({ feedingRulesCount, rulesStatus, referencingRulesCount, referencingStatus, onClick }) => {
  if (rulesStatus !== 'done') return null;

  return (
    <VerdictTile
      label="Why, and who reads it"
      icon="bolt"
      headline={`${plural(feedingRulesCount, 'rule')} assign into this group`}
      detail={
        referencingStatus === 'done'
          ? `${plural(referencingRulesCount, 'rule')} reference it`
          : undefined
      }
      onClick={onClick}
    />
  );
};

/**
 * The "app push" tile — rendered only when the group carries at least one
 * push mapping. `undefined` (never synced) and `[]` (confirmed none) both
 * omit the tile; a group that isn't pushed anywhere gets no card at all,
 * never a "0 mappings" one, per the plan's explicit rule.
 */
const AppPushTile: React.FC<{ group: GroupSummary; onClick: () => void }> = ({
  group,
  onClick,
}) => {
  const mappings = group.pushMappings;
  if (!mappings || mappings.length === 0) return null;

  return (
    <VerdictTile
      label="App push"
      icon="refresh"
      headline={`Pushed to ${plural(mappings.length, 'app')}`}
      detail="Membership syncs out to each target group's app."
      onClick={onClick}
    />
  );
};

/**
 * Renders the Overview pane's verdict tiles. Every tile links into the tab
 * that can answer the claim it makes — `onNavigate` is the same `setActiveTab`
 * the tab strip itself uses.
 */
const GroupOverviewPane: React.FC<GroupOverviewPaneProps> = ({
  group,
  breakdown,
  memberStatus,
  feedingRulesCount,
  rulesStatus,
  appsCount,
  appsStatus,
  rolesCount,
  rolesStatus,
  referencingRulesCount,
  referencingStatus,
  onNavigate,
}) => (
  <div className="space-y-3" role="tabpanel" aria-label="Overview">
    <MembershipSourceTile
      breakdown={breakdown}
      memberStatus={memberStatus}
      onClick={() => onNavigate('members')}
    />

    <div className="grid grid-cols-2 gap-3">
      <AccessGrantsTile
        appsCount={appsCount}
        appsStatus={appsStatus}
        rolesCount={rolesCount}
        rolesStatus={rolesStatus}
        onClick={() => onNavigate('access')}
      />

      <RuleRelationshipsTile
        feedingRulesCount={feedingRulesCount}
        rulesStatus={rulesStatus}
        referencingRulesCount={referencingRulesCount}
        referencingStatus={referencingStatus}
        onClick={() => onNavigate('rules')}
      />
    </div>

    <AppPushTile group={group} onClick={() => onNavigate('access')} />
  </div>
);

export default GroupOverviewPane;
