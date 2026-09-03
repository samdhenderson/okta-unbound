/**
 * @module sidepanel/components/users/comparison/ClauseGroupList
 * @description The groups a failing `isMemberOf*` clause names, rendered per polarity.
 *
 * Extracted from {@link module:sidepanel/components/users/comparison/CauseWorklistRow}
 * so both files stay under the ~300-line component bar. Pure: no I/O, no logging.
 *
 * ## The two polarities are not mirror images
 *
 * A **positive** clause (`isMemberOfAnyGroup(a, b, c)`) failed because *none* of
 * its groups matched, so every candidate is worth listing — that is what makes
 * "it wanted any one of these and you have none" legible. Satisfied entries are
 * marked rather than hidden, so a partially-satisfied list cannot be misread as
 * "all of these are missing".
 *
 * A **negated** clause (`!isMemberOfAnyGroup(…)`) failed because one *did* match.
 * A real rule may exclude twenty groups of which the user is in one, so listing
 * all twenty buries the only actionable fact. Only the memberships they actually
 * hold are shown; the rest are counted and tucked behind a disclosure.
 *
 * ## Security
 *
 * Group names and ids are untrusted, end-user-controllable tenant data. Rendered
 * through React's escaping — never `dangerouslySetInnerHTML` — and never logged;
 * this module logs nothing.
 */
import React, { useState } from 'react';
import { Button, CopyableId } from '../../shared';
import type {
  ClauseGroupReference,
  ClauseGroupRequirement,
} from '../../../../shared/rules/explainExpression';

/** Positive-clause candidates shown before the list collapses. */
const CANDIDATE_PREVIEW_LIMIT = 5;

/**
 * How each match kind reads when the group has no resolvable name — the pattern
 * variants never name one group, so they always read this way.
 */
const groupMatchLabel: Record<ClauseGroupReference['match'], (value: string) => string> = {
  id: (value) => value,
  name: (value) => value,
  nameStartsWith: (value) => `any group whose name starts with “${value}”`,
  nameContains: (value) => `any group whose name contains “${value}”`,
};

/** Props for {@link ClauseGroupList}. */
export interface ClauseGroupListProps {
  /**
   * **Every** group the clause named, satisfied or not — not a pre-filtered set.
   * This component decides what to show from {@link requirement}, so a caller
   * cannot accidentally hide the one entry that explains the failure.
   */
  references: readonly ClauseGroupReference[];
  /** Which way round the clause asked. */
  requirement: ClauseGroupRequirement;
  /** Display name of the user who lacks the access, for the copy. */
  contextName?: string;
  /**
   * Turns a group id into its name. A rule refers to a group by id, which is
   * unreadable on its own; ids with no known name fall back to the id itself.
   */
  resolveGroupName?: (groupId: string) => string | undefined;
  /**
   * Per-group action. Rendered only for entries the user could act on — the
   * unsatisfied ones under `member`, the satisfied ones under `non-member`.
   * Returning `null` for a group the host cannot resolve is expected; the entry
   * is still named.
   */
  renderGroupAction?: (reference: ClauseGroupReference) => React.ReactNode;
}

/**
 * The prerequisite or disqualifying groups behind a failing clause.
 *
 * @param props - See {@link ClauseGroupListProps}.
 */
const ClauseGroupList: React.FC<ClauseGroupListProps> = ({
  references,
  requirement,
  contextName,
  resolveGroupName,
  renderGroupAction,
}) => {
  const [expanded, setExpanded] = useState(false);
  if (references.length === 0) return null;

  const who = contextName ?? 'This user';
  const blocking = references.filter((reference) => reference.satisfied);

  // Under `non-member` the satisfied entries ARE the finding, so an unsatisfied
  // one is merely part of the excluded set and stays hidden until asked for.
  const shown =
    requirement === 'non-member'
      ? blocking
      : expanded
        ? references
        : references.slice(0, CANDIDATE_PREVIEW_LIMIT);

  const hiddenCount = references.length - shown.length;

  return (
    <div className="mt-2">
      <p className="text-xs font-medium text-neutral-700">
        {requirement === 'non-member'
          ? exclusionHeading(who, references.length, blocking.length)
          : prerequisiteHeading(who, references, blocking.length)}
      </p>

      <ul className="mt-1 space-y-1">
        {shown.map((reference) => (
          <GroupEntry
            key={`${reference.match}-${reference.value}`}
            reference={reference}
            requirement={requirement}
            resolveGroupName={resolveGroupName}
            renderGroupAction={renderGroupAction}
          />
        ))}
      </ul>

      {hiddenCount > 0 &&
        (requirement === 'non-member' ? (
          // Never expandable in place: the other entries are groups the user is
          // NOT in, which is context rather than a finding. Stating the count is
          // the honest middle ground between hiding it and burying the one row
          // that matters under nineteen that do not.
          <p className="mt-1 text-xs text-neutral-500">
            The rule excludes {hiddenCount} other {hiddenCount === 1 ? 'group' : 'groups'} {who} is
            not in.
          </p>
        ) : (
          <Button variant="ghost" size="sm" className="mt-1" onClick={() => setExpanded(true)}>
            Show {hiddenCount} more {hiddenCount === 1 ? 'group' : 'groups'}
          </Button>
        ))}
    </div>
  );
};

/** "…would qualify by joining…" — phrased for how much of the list is already met. */
function prerequisiteHeading(
  who: string,
  references: readonly ClauseGroupReference[],
  satisfiedCount: number,
): string {
  const one = references.length === 1;
  if (satisfiedCount === 0) {
    return `${who} would qualify by joining ${one ? 'this group' : 'any one of these groups'}:`;
  }
  return `The rule asks for ${one ? 'this group' : 'one of these groups'}:`;
}

/** "…must not be in any of N…" — leads with the count they are actually in. */
function exclusionHeading(who: string, total: number, blockingCount: number): string {
  const scope = total === 1 ? 'this group' : `any of ${total} excluded groups`;
  if (blockingCount === 0) return `${who} must not be in ${scope}.`;
  return `${who} must not be in ${scope}. They are in ${blockingCount}:`;
}

/** One group of the list: its name, its id, and whatever action applies to it. */
const GroupEntry: React.FC<{
  reference: ClauseGroupReference;
  requirement: ClauseGroupRequirement;
  resolveGroupName?: (groupId: string) => string | undefined;
  renderGroupAction?: (reference: ClauseGroupReference) => React.ReactNode;
}> = ({ reference, requirement, resolveGroupName, renderGroupAction }) => {
  // The group they matched, when there is one, is the most specific truth — a
  // `nameStartsWith` reference resolves to a real group only this way.
  const resolvedName =
    reference.matchedGroupName ??
    (reference.match === 'id' ? resolveGroupName?.(reference.value) : undefined);
  const label = resolvedName ?? groupMatchLabel[reference.match](reference.value);
  // Show the id underneath only when it is NOT already the visible label, so an
  // unresolved id appears once rather than twice.
  const showId = reference.match === 'id' && resolvedName !== undefined;

  const actionable = requirement === 'non-member' ? reference.satisfied : !reference.satisfied;
  const blocking = requirement === 'non-member' && reference.satisfied;

  return (
    <li
      className={`flex items-center justify-between gap-2 rounded-md px-2 py-1 ${
        blocking ? 'border border-danger-light bg-danger-light' : 'bg-neutral-50'
      }`}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-xs text-neutral-900" title={label}>
            {label}
          </span>
          {/* Stated in words, never by colour alone. */}
          {blocking && (
            <span className="shrink-0 text-xs font-medium text-danger-text">blocking</span>
          )}
          {requirement === 'member' && reference.satisfied && (
            <span className="shrink-0 text-xs font-medium text-success-text">already in</span>
          )}
        </span>
        {showId && (
          <CopyableId value={reference.value} label={`Copy group id ${reference.value}`} />
        )}
      </span>
      {actionable && <span className="shrink-0">{renderGroupAction?.(reference)}</span>}
    </li>
  );
};

export default ClauseGroupList;
