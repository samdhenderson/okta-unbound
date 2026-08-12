/**
 * @module sidepanel/components/users/comparison/CauseWorklist
 * @description The comparison's access differences, grouped by what an admin would DO about them.
 *
 * A pure view over {@link module:sidepanel/components/users/comparison/accessCause}:
 * it renders {@link AccessCause} rows grouped by {@link AccessRemedy} via
 * `groupCausesByRemedy`, and owns the *copy* the classifier deliberately does not
 * carry (that module emits codes, never sentences). No I/O, no logging.
 *
 * ## `cannot-determine` is a first-class group
 *
 * It is never folded into another remedy, never hidden because it is short, and
 * never styled as a failure. It gets its own visible group even at one row, with
 * the **neutral** palette — not `danger` (nothing resolved to false) and not
 * `warning` (nothing is wrong; we simply could not tell). Merging it into
 * `blocked-by-attribute` would tell an admin to go change a profile value that was
 * never the problem. Each row turns its `undeterminedReason` code into a sentence
 * that says *why* — see
 * {@link module:sidepanel/components/users/comparison/CauseWorklistRow}, which
 * carries the row-level copy and keeps both files under the ~300-line bar.
 *
 * ## Three empty states, never conflated
 *
 * 1. `causes` **absent** — not computed. Nothing has been ruled out.
 * 2. `causes` present but **empty** — computed, and there is nothing to explain.
 * 3. A remedy group with zero rows — simply not rendered.
 *
 * ## Security
 *
 * Group names, rule names and `resolvedValue` are untrusted, end-user-controllable
 * tenant data and PII. They are rendered through React's escaping — never
 * `dangerouslySetInnerHTML` — and are **never logged**; this component logs nothing.
 */
import React from 'react';
import Icon, { type IconType } from '../../overview/shared/Icon';
import CauseWorklistRow from './CauseWorklistRow';
import { groupCausesByRemedy, type AccessCause, type AccessRemedy } from './accessCause';

/** How one {@link AccessRemedy} is presented. Colour never carries the meaning alone. */
interface RemedyPresentation {
  /** The visible group heading — the action, not the cause. */
  readonly heading: string;
  /** One line telling an admin what closing this group involves. */
  readonly description: string;
  /** Decorative glyph beside the heading. */
  readonly icon: IconType;
  /** Group container surface/border tokens. */
  readonly groupClass: string;
  /** Glyph colour token. */
  readonly iconClass: string;
}

/**
 * Remedy → presentation.
 *
 * `cannot-determine` deliberately maps to the **neutral** palette, mirroring
 * `ClauseChecklist`'s `not-evaluated` treatment: it is not a `danger` and not a
 * `warning`, because nothing here is known to be wrong.
 */
const remedyPresentation: Record<AccessRemedy, RemedyPresentation> = {
  'blocked-by-attribute': {
    heading: 'Fix a profile attribute',
    description:
      'A rule feeds this group and a clause that was actually checked failed. Change the profile value — or the rule.',
    icon: 'alert',
    groupClass: 'border-warning-light bg-warning-light',
    iconClass: 'text-warning',
  },
  'excluded-by-rule': {
    heading: 'Remove a rule exclusion',
    description:
      'A rule targets this group but lists this user as an exclusion, so they would otherwise qualify.',
    icon: 'lock',
    groupClass: 'border-danger-light bg-danger-light',
    iconClass: 'text-danger',
  },
  'manual-add': {
    heading: 'Add the user manually',
    description:
      'No rule accounts for this access, so it was granted by hand. Grant it by hand here too.',
    icon: 'plus',
    groupClass: 'border-primary-highlight bg-primary-light',
    iconClass: 'text-primary-text',
  },
  'cannot-determine': {
    heading: 'Needs investigation',
    description:
      'We could not work these out. Nothing here is known to be wrong — check them before you act.',
    icon: 'minus',
    groupClass: 'border-neutral-200 bg-neutral-50',
    iconClass: 'text-neutral-500',
  },
};

/** Props for {@link CauseWorklist}. */
interface CauseWorklistProps {
  /**
   * Access differences classified by remedy. **Absent means "not computed"** —
   * which is rendered differently from an empty array ("computed, none found").
   */
  causes?: readonly AccessCause[];
  /** Display name for the context user — the one who LACKS the access. */
  contextName: string;
  /** Display name for the compared user — the one who HAS it. */
  comparedName: string;
  /**
   * Opens the full clause checklist for one cause (the group's rule condition
   * explained clause by clause against the context user). Omitted, a row still
   * previews its failing clauses inline but offers no jump.
   */
  onViewClauses?: (cause: AccessCause) => void;
}

/**
 * The access worklist: every difference the compared user has and the context user
 * lacks, grouped by the action that would close it.
 *
 * @param props - See {@link CauseWorklistProps}.
 */
const CauseWorklist: React.FC<CauseWorklistProps> = ({
  causes,
  contextName,
  comparedName,
  onViewClauses,
}) => (
  <section
    aria-labelledby="cause-worklist-heading"
    className="rounded-lg border border-neutral-200 bg-white p-3"
  >
    <div className="flex items-center gap-2">
      <span className="rounded-md bg-neutral-100 p-1.5 text-neutral-700">
        <Icon type="list" size="sm" />
      </span>
      <h4 id="cause-worklist-heading" className="text-sm font-semibold text-neutral-900">
        What to fix
      </h4>
    </div>
    <p className="mt-1 text-xs text-neutral-600">
      Access {comparedName} has that {contextName} does not, grouped by what would close it.
    </p>

    {causes === undefined ? (
      <WorklistNote
        title="Causes not computed"
        body={`This comparison has not worked out why ${comparedName} has access ${contextName} does not. Nothing has been ruled out.`}
      />
    ) : causes.length === 0 ? (
      <WorklistNote
        title="No access differences to explain"
        body={`${comparedName} has no group access ${contextName} is missing.`}
      />
    ) : (
      <div className="mt-3 space-y-3">
        {groupCausesByRemedy(causes).map(({ remedy, causes: rows }) => (
          <RemedyGroup key={remedy} remedy={remedy} causes={rows} onViewClauses={onViewClauses} />
        ))}
      </div>
    )}
  </section>
);

/** A neutral panel note — used for both "not computed" and "nothing found". */
const WorklistNote: React.FC<{ title: string; body: string }> = ({ title, body }) => (
  <div className="mt-3 rounded-md border border-neutral-200 bg-neutral-50 p-3">
    <p className="text-sm font-medium text-neutral-900">{title}</p>
    <p className="mt-1 text-xs text-neutral-600">{body}</p>
  </div>
);

/** Props for {@link RemedyGroup}. */
interface RemedyGroupProps {
  /** The remedy every row in this group shares. */
  remedy: AccessRemedy;
  /** The rows, in classifier order. Never empty — `groupCausesByRemedy` drops empties. */
  causes: readonly AccessCause[];
  /** Forwarded to each row's clause-checklist jump. */
  onViewClauses?: (cause: AccessCause) => void;
}

/** One remedy's heading, what-it-means line, row count, and its rows. */
const RemedyGroup: React.FC<RemedyGroupProps> = ({ remedy, causes, onViewClauses }) => {
  const presentation = remedyPresentation[remedy];

  return (
    <section
      aria-labelledby={`remedy-${remedy}`}
      className={`rounded-md border p-3 ${presentation.groupClass}`}
    >
      <div className="flex items-start gap-2">
        <span aria-hidden="true" className="mt-0.5 inline-flex shrink-0">
          <Icon type={presentation.icon} size="sm" className={presentation.iconClass} />
        </span>
        <div className="min-w-0 flex-1">
          <h5 id={`remedy-${remedy}`} className="text-sm font-semibold text-neutral-900">
            {presentation.heading}
          </h5>
          <p className="mt-0.5 text-xs text-neutral-700">{presentation.description}</p>
        </div>
        <span className="shrink-0 rounded-md border border-neutral-200 bg-white px-2 py-0.5 text-xs font-medium text-neutral-700">
          {causes.length} {causes.length === 1 ? 'group' : 'groups'}
        </span>
      </div>

      <ul className="mt-2 space-y-2">
        {causes.map((cause) => (
          <CauseWorklistRow key={cause.groupId} cause={cause} onViewClauses={onViewClauses} />
        ))}
      </ul>
    </section>
  );
};

export default CauseWorklist;
