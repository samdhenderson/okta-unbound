/**
 * @module sidepanel/components/users/comparison/AppScopeIndicator
 * @description The per-row marker on an app diff row: how Okta reports the assignment, or why it cannot be reported.
 *
 * Four states, and the visual language separates two of them from the other two:
 * a **chip** is an answer Okta actually gave (`Direct`, `Via group`), and **muted
 * italic text** is a non-answer (`Source unknown`, `Source not compared`). A row
 * therefore never leaves the reader to infer a source from the *absence* of a
 * chip — the absence is itself spelled out.
 *
 * Neither answer is styled as good or bad. A group-granted assignment is not a
 * problem, so both chips share one neutral recipe and differ only in their words
 * (which also means the distinction is never carried by colour alone).
 */
import React from 'react';
import type { AppAssignmentScope } from '../../../../shared/schemas/okta';

/**
 * What one app row can honestly say about where its assignment comes from.
 *
 * - `'USER'` / `'GROUP'` — the {@link AppAssignmentScope} Okta reported for the
 *   user this row is about.
 * - `'unknown'` — Okta reported no usable scope for this row. It is **not** a
 *   synonym for `'GROUP'`, and not a synonym for "no direct assignment"; it means
 *   the answer is missing.
 * - `'notCompared'` — the row is about *both* users but only one user's scope is
 *   in hand (the shared bucket is derived from the compared user's assignments
 *   alone), so stating it would describe one user as if it described both.
 */
export type AppScopeIndicatorState = AppAssignmentScope | 'unknown' | 'notCompared';

/** Classes shared by every state; each state adds its own chip or non-answer treatment. */
const baseClasses = 'shrink-0 whitespace-nowrap text-xs';

/** The neutral chip recipe, used identically by both answers — no scope is the "good" one. */
const chipClasses =
  'rounded-md border border-neutral-200 bg-neutral-100 px-2 py-0.5 font-medium text-neutral-700';

/** Muted, un-chipped treatment for the two states that are not answers. */
const nonAnswerClasses = 'italic text-neutral-400';

/**
 * Per-state label, hover description, and styling, keyed by
 * {@link AppScopeIndicatorState}.
 *
 * The labels are deliberately non-exclusive. Okta returns a **single** scope per
 * app-user and reports `'USER'` when a user is both directly assigned *and* in an
 * assigned group, so `'Direct'` can only mean "there is a direct assignment" —
 * never "direct only", "not via group", or anything a reader could act on as if
 * the group path had been ruled out.
 */
const stateStyles: Record<
  AppScopeIndicatorState,
  { label: string; description: string; className: string }
> = {
  USER: {
    label: 'Direct',
    description:
      'Okta reports a direct assignment to this app for this user. A group may grant the same app as well — Okta reports only one source per app, so this does not rule out a group path.',
    className: chipClasses,
  },
  GROUP: {
    label: 'Via group',
    description:
      'Okta reports this assignment as coming from a group rather than from a direct assignment. Which group grants it is not shown — naming it costs an extra request per app.',
    className: chipClasses,
  },
  unknown: {
    label: 'Source unknown',
    description:
      'Okta reported no assignment source for this app, so the source is unknown — this is not a way of saying "via group", and not a way of saying "direct".',
    className: nonAnswerClasses,
  },
  notCompared: {
    label: 'Source not compared',
    description:
      "Both users hold this app, but Okta reports an assignment source per user and only the compared user's source is loaded here. Showing it would state one user's source as if it described both.",
    className: nonAnswerClasses,
  },
};

/** Props for {@link AppScopeIndicator}. */
interface AppScopeIndicatorProps {
  /**
   * Which of the four things this row can say — see
   * {@link AppScopeIndicatorState}. Callers holding an optional scope pass
   * `scope ?? 'unknown'`; a missing scope must never be collapsed into `'GROUP'`.
   */
  state: AppScopeIndicatorState;
}

/**
 * Renders one app row's assignment-source marker: a neutral chip for a scope Okta
 * reported, or muted italic text naming why no scope can be shown.
 *
 * The visible words are the accessible name — the distinction is never carried by
 * colour or by an icon — and the fuller caveat rides on `title`.
 *
 * @param props - See {@link AppScopeIndicatorProps}.
 */
const AppScopeIndicator: React.FC<AppScopeIndicatorProps> = ({ state }) => {
  const s = stateStyles[state];
  return (
    <span className={`${baseClasses} ${s.className}`} title={s.description}>
      {s.label}
    </span>
  );
};

export default AppScopeIndicator;
