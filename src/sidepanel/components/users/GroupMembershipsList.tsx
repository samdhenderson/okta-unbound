/**
 * @module sidepanel/components/users/GroupMembershipsList
 * @description The Groups pane of the user-detail rung: every group the user is
 * in, what put them there, and how much that answer is worth.
 *
 * The pane is one spine — **summary line → filter → source pills → rows → empty
 * state** — shared with the rung's other panes. Its accounting line names every
 * bucket that has rows in it and omits the ones that do not; a surface that
 * silently dropped a category would be worse than no summary, because a reader
 * who trusts it concludes those rows do not exist.
 *
 * ## One verdict, one source line, everything else behind the disclosure
 *
 * A row used to carry the raw membership enum, a second group-type badge, three
 * stacked hedges and a "Prove it" action — four statements about provenance on a
 * collapsed row. Now it carries {@link membershipVerdict}'s single badge and
 * `membershipSourceLine`'s single sentence, and the caveat, the per-rule
 * evidence, the app grants, the proof action and the Okta deep link all live
 * inside {@link sidepanel/components/users/GroupMembershipRow}'s disclosure.
 *
 * ## Why the filter state lives here
 *
 * The panes of this rung are **hidden, not unmounted** (ADR-0016/0018), so the
 * filter text, the selected bucket and the set of open rows survive a pane switch
 * as plain `useState` — `docs/state-management.md` names local state the
 * preferred option over lifting when nothing else needs to read it. Open rows are
 * held here rather than in the row so that filtering a row out and back in does
 * not close it.
 *
 * ## The pane is where the group context comes from
 *
 * This is the only node in the row → evidence → checklist chain that holds the
 * user's **whole** membership list, so it is the only one allowed to build the
 * {@link module:shared/ruleEvaluator.RuleGroupContext} those checklists evaluate
 * `isMemberOf*` against. It is built once here and threaded down unchanged; the
 * filtered `visible` list never feeds it, because `isMemberOf*` is two-valued over
 * whatever list it is given (ADR-0021) and a subset would turn "Cannot be
 * determined" into a confident wrong answer.
 *
 * ## Every classification here is a deduction
 *
 * `GET /api/v1/users/{id}/groups` carries no attribution embed (ADR-0020), so
 * every badge on this pane is the classifier's opinion. Supply
 * `onProveMembershipSource` and each **opened** row gains an "Ask Okta" action
 * that replaces that one guess with Okta's own answer (ADR-0031); see
 * {@link sidepanel/components/users/GroupMembershipsListProof}. It is one API
 * call per row and is never run automatically.
 */
import React, { useMemo, useState } from 'react';
import { EmptyState, FilterPill, IconButton, Input, Skeleton } from '../shared';
import Icon from '../shared/Icon';
import GroupMembershipRow from './GroupMembershipRow';
import { useMembershipProofs } from './GroupMembershipsListProof';
import {
  BUCKET_PILL_LABELS,
  filterMemberships,
  membershipSummaryLine,
  type MembershipBucket,
  type MembershipBucketFilter,
} from './membershipVerdict';
import type { MemberRuleAttribution } from '../../../shared/membership/memberRuleAttribution';
import { groupContextOf } from '../../../shared/membership/groupContext';
import type { GroupMembership, OktaUser } from '../../../shared/types';

/** The pills, in the order the summary line reads its terms. */
const BUCKET_ORDER: readonly MembershipBucket[] = ['rule', 'direct', 'app', 'unresolved'];

/** Props for {@link GroupMembershipsList}. */
interface GroupMembershipsListProps {
  /** The user's group memberships, each already classified as direct or rule-based. */
  memberships: GroupMembership[];
  /**
   * The user the memberships belong to. When supplied, a rule-based row explains
   * that rule's condition clause by clause against them; without it the row falls
   * back to showing the raw condition, since an explanation would have nothing to
   * evaluate against.
   */
  user?: OktaUser;
  /**
   * When true, shows row skeletons instead of the list — and withholds the group
   * context built from `memberships`, which is only the user's complete set once
   * the load has settled.
   */
  isLoading: boolean;
  /** Group id to mark as the group being browsed elsewhere in the panel, if any. */
  currentGroupId?: string;
  /** Okta origin used to build admin-console deep links; links are hidden when absent. */
  oktaOrigin?: string | null;
  /**
   * Id of a group that was just successfully added this session; its row plays a
   * one-shot `animate-affirm-flash` (success background/border fading to
   * transparent) instead of the confirmation only showing in a banner. Absent or
   * non-matching ids render no flash.
   */
  recentlyAddedGroupId?: string | null;
  /**
   * Applications each group grants, keyed by group id — the link across to the
   * Apps pane, supplied by whoever already knows the answer.
   *
   * **Absent is not empty.** A group with no entry renders no "Also grants" line
   * at all rather than claiming it grants nothing; this pane never fetches app
   * assignments to fill the gap (`docs/components.md`, "list rows derive; they
   * never fetch").
   */
  appsByGroupId?: Record<string, string[]>;
  /**
   * Asks Okta which rules manage one membership
   * (`GET /api/v1/groups/{groupId}/users/{userId}/group-rules`), resolving to its
   * three-state answer. Supplied, each opened row gains an "Ask Okta" action;
   * omitted, the surface stays exactly as it was.
   *
   * **One API call per row**, so it is invoked only from that click — never for
   * the list, and never on mount.
   */
  onProveMembershipSource?: (groupId: string) => Promise<MemberRuleAttribution>;
}

/**
 * The Groups pane: a user's memberships, each with one verdict and one source
 * line, filterable by text and by source bucket.
 *
 * @param props - See {@link GroupMembershipsListProps}.
 */
const GroupMembershipsList: React.FC<GroupMembershipsListProps> = ({
  memberships,
  user,
  isLoading,
  currentGroupId,
  oktaOrigin,
  recentlyAddedGroupId,
  appsByGroupId,
  onProveMembershipSource,
}) => {
  const [query, setQuery] = useState('');
  const [bucket, setBucket] = useState<MembershipBucketFilter>('all');
  const [openGroupIds, setOpenGroupIds] = useState<ReadonlySet<string>>(() => new Set());
  /*
    This pane's contract stays "tell me a group id" — the user is fixed for the
    whole list, so the group is the only thing that varies and the caller has
    nothing else to supply. The hook itself takes the whole membership, because a
    group's roster varies along the opposite axis; the adapter is the seam between
    the two, memoised so `prove` keeps a stable identity across renders.
  */
  const resolveProof = useMemo(
    () =>
      onProveMembershipSource
        ? (membership: GroupMembership) => onProveMembershipSource(membership.group.id)
        : undefined,
    [onProveMembershipSource],
  );
  const proofs = useMembershipProofs(resolveProof);

  const summary = useMemo(() => membershipSummaryLine(memberships), [memberships]);
  const visible = useMemo(
    () => filterMemberships(memberships, query, bucket),
    [memberships, query, bucket],
  );

  // Built once for the whole pane, from `memberships` — never from `visible`, and
  // never per row. It is the same user's group list for every row, and rebuilding
  // it per row would re-map it dozens of times (the reason
  // `accessCause.classifyAccessCauses` builds it once too).
  //
  // Deliberately `undefined` while loading. `isMemberOf*` is two-valued over the
  // list it is given (ADR-0021), so a partial list is not a smaller answer, it is
  // a wrong one: groups the user really is in would be reported as clauses they
  // failed. `memberships` is the complete, unfiltered set only once the load has
  // settled — `useUserMemberships` assigns it in one `setMemberships` after
  // `getUserGroupsRequest` has followed every `Link` page, and empties it on
  // failure — so "not loaded yet" hands the checklist nothing and it keeps saying
  // "Cannot be determined", which is the honest answer.
  const groupContext = useMemo(
    () => (isLoading ? undefined : groupContextOf(memberships)),
    [isLoading, memberships],
  );

  const toggleRow = (groupId: string) =>
    setOpenGroupIds((current) => {
      const next = new Set(current);
      if (!next.delete(groupId)) next.add(groupId);
      return next;
    });

  const clearFilters = () => {
    setQuery('');
    setBucket('all');
  };

  const hasMemberships = memberships.length > 0;

  return (
    // Chromeless, like its two sibling panes: the rung's `UserDetailPanel` owns
    // the one card the three panes share. A card here too made a box inside a
    // box, briefly patched at the call site with a `-m-px` that pulled this
    // border under the parent's `overflow-hidden`. Deleting the chrome is the
    // fix; hiding a duplicate border is not.
    <section aria-label="Group memberships">
      {hasMemberships && !isLoading && (
        // No band chrome. The pane's two siblings — Apps and Profile — put their
        // own summary-and-filter zone on the shared card's plain white, and this
        // one drew a grey stripe with a rule under it instead, so the same
        // furniture read as a different kind of object depending on which pane
        // you were on. Grouping here comes from the spacing below, which is what
        // separates every other stack of controls in the panel.
        <div className="space-y-(--sp-field) p-(--sp-card) pb-0">
          {/*
            The accounting line. Every bucket with rows in it is named; a bucket
            with none is omitted rather than printed as a zero.
          */}
          <p className="text-xs text-neutral-600">{summary}</p>

          <Input
            size="sm"
            type="search"
            value={query}
            onChange={setQuery}
            ariaLabel="Filter group memberships"
            placeholder="Filter groups or rules…"
            icon={<Icon type="search" size="sm" />}
            trailingInteractive
            trailing={
              query ? (
                <IconButton
                  label="Clear the group filter"
                  variant="ghost"
                  size="sm"
                  onClick={() => setQuery('')}
                >
                  <Icon type="close" size="sm" />
                </IconButton>
              ) : undefined
            }
          />

          <div className="flex flex-wrap gap-(--sp-inline)">
            <FilterPill active={bucket === 'all'} onClick={() => setBucket('all')}>
              All
            </FilterPill>
            {BUCKET_ORDER.map((value) => (
              <FilterPill
                key={value}
                active={bucket === value}
                onClick={() => setBucket(value)}
                title={`Show only ${BUCKET_PILL_LABELS[value].toLowerCase()} memberships`}
              >
                {BUCKET_PILL_LABELS[value]}
              </FilterPill>
            ))}
          </div>
        </div>
      )}

      {isLoading ? (
        // The rows are a known height, so the placeholder previews them rather
        // than spinning, and nothing shifts when they land.
        <div className="space-y-(--sp-rung) p-(--sp-card)">
          <Skeleton variant="row" size="lg" count={4} label="Loading group memberships..." />
        </div>
      ) : !hasMemberships ? (
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-sm text-neutral-500">This user is not a member of any groups</p>
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon="users"
          title="No memberships match"
          description="No group matches this filter, either by name or by the rule that granted it."
          actions={[{ label: 'Clear filters', onClick: clearFilters, variant: 'secondary' }]}
        />
      ) : (
        <div className="space-y-(--sp-rung) p-(--sp-card)">
          {visible.map((membership) => (
            <GroupMembershipRow
              key={membership.group.id}
              membership={membership}
              user={user}
              groupContext={groupContext}
              isCurrentGroup={membership.group.id === currentGroupId}
              expanded={openGroupIds.has(membership.group.id)}
              onToggle={toggleRow}
              oktaOrigin={oktaOrigin}
              flash={membership.group.id === recentlyAddedGroupId}
              appNames={appsByGroupId?.[membership.group.id]}
              proofEnabled={proofs.enabled}
              proofOutcome={proofs.outcomeFor(membership.group.id)}
              onProve={proofs.prove}
            />
          ))}
        </div>
      )}
    </section>
  );
};

export default GroupMembershipsList;
