/**
 * @module sidepanel/components/groups/detail/RuleExpressionText
 * @description Rule-condition text with its **group-id literals resolved to named
 * badges** — `isMemberOfAnyGroup("00gFAKE1")` reads as the group, not as an opaque id.
 *
 * Extracted rather than inlined into {@link ClauseChecklist} because both surfaces
 * that print reconstructed condition text need it —
 * {@link module:sidepanel/components/groups/detail/ClauseChecklist} and
 * {@link module:sidepanel/components/users/comparison/CauseWorklistRow} — and
 * either copy of the tokeniser would be free to drift from the other. It follows
 * the extraction precedent of `ClauseGroupList`, which came out of the same row
 * for the same reason. Pure: no I/O, no logging.
 *
 * ## It resolves nothing it was not already given
 *
 * The only names available are the ones the caller already holds, through the
 * same `resolveGroupName` shape `ClauseGroupList` takes. This component never
 * fetches, and an id with no known name renders exactly as it did before —
 * quoted, in mono, inside the expression — so a missing name costs the reader
 * nothing they had.
 *
 * ## A literal only becomes a badge when it resolves to a name
 *
 * The tokeniser does **not** guess which quoted literal is a group id: it offers
 * every string literal to the resolver and badges only what comes back named.
 * That is what keeps `user.department == "Engineering"` printing as itself — the
 * resolvers in this app are keyed by Okta group id, so a department string finds
 * nothing. A literal containing an escaped quote is left as text for the same
 * reason: the value recovered would be wrong, so it resolves to nothing.
 *
 * ## Security
 *
 * Expression text and group names are untrusted, end-user-controllable tenant
 * data. The text is **split**, never parsed into markup: each piece is rendered
 * as React text (escaped) and each badge takes its id and name as props, so no
 * HTML is ever built from tenant input. `dangerouslySetInnerHTML` is not used
 * here and must not be introduced. This module logs nothing.
 */
import React, { useMemo } from 'react';
import { EntityLink } from '../../shared';

/**
 * Turns a group id embedded in rule text into its display name, or `undefined`
 * when this view has no name for it. The same shape `ClauseGroupList` takes, so a
 * caller threads one resolver to both.
 */
export type GroupNameResolver = (groupId: string) => string | undefined;

/** Props for {@link RuleExpressionText}. */
export interface RuleExpressionTextProps {
  /**
   * The condition text to render — a clause's reconstructed `expressionText`.
   * **Untrusted:** rendered escaped, never logged.
   */
  text: string;
  /**
   * Names the group ids inside {@link text}. Omitted (or returning `undefined`
   * for an id), the literal keeps its raw quoted form — the fallback this view
   * has always had.
   */
  resolveGroupName?: GroupNameResolver;
  /** Classes for the `<code>` element, so each host keeps its own type treatment. */
  className?: string;
}

/** One piece of tokenised expression text: verbatim source, or a named group. */
type ExpressionSegment =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'group'; readonly id: string; readonly name: string };

/**
 * A single-quoted or double-quoted string literal. Okta's own `raw` quoting is
 * preserved by the clause reconstruction, so both forms occur. Escaped quotes are
 * deliberately not handled — see the module note.
 */
const QUOTED_LITERAL = /"([^"]*)"|'([^']*)'/g;

/**
 * Split expression text into verbatim runs and the group literals that resolved.
 *
 * @param text - The condition text (untrusted).
 * @param resolveGroupName - Name lookup; without one, the text is one segment.
 * @returns Segments in source order, covering the whole input exactly once.
 */
function segmentExpression(
  text: string,
  resolveGroupName?: GroupNameResolver,
): readonly ExpressionSegment[] {
  if (!resolveGroupName || text.length === 0) return [{ kind: 'text', text }];

  const segments: ExpressionSegment[] = [];
  let cursor = 0;

  for (const match of text.matchAll(QUOTED_LITERAL)) {
    const start = match.index;
    if (start === undefined) continue;
    const id = match[1] ?? match[2] ?? '';
    const name = resolveGroupName(id);
    // Unresolved literals are left in the verbatim run: the fallback is the raw
    // text, not a badge that would have to invent a label.
    if (name === undefined) continue;

    if (start > cursor) segments.push({ kind: 'text', text: text.slice(cursor, start) });
    segments.push({ kind: 'group', id, name });
    cursor = start + match[0].length;
  }

  if (cursor < text.length) segments.push({ kind: 'text', text: text.slice(cursor) });
  return segments;
}

/**
 * Condition text in mono, with every resolvable group id shown as a named badge
 * that opens the group and can copy the raw id.
 *
 * @example
 * ```tsx
 * <RuleExpressionText
 *   text={clause.expressionText}
 *   resolveGroupName={resolveGroupName}
 *   className="font-mono text-xs text-neutral-900"
 * />
 * ```
 *
 * @param props - See {@link RuleExpressionTextProps}.
 */
const RuleExpressionText: React.FC<RuleExpressionTextProps> = ({
  text,
  resolveGroupName,
  className = '',
}) => {
  const segments = useMemo(
    () => segmentExpression(text, resolveGroupName),
    [text, resolveGroupName],
  );

  return (
    <code className={className}>
      {segments.map((segment, index) =>
        segment.kind === 'text' ? (
          <React.Fragment key={`text-${index}`}>{segment.text}</React.Fragment>
        ) : (
          <EntityLink
            key={`group-${index}`}
            type="group"
            id={segment.id}
            name={segment.name}
            copyId
            // The id is no longer on screen, so the copy control names it rather
            // than the group: two groups in one condition can share a display
            // name, and then the derived default would collide (I-009).
            copyIdLabel={`Copy group id ${segment.id}`}
            className="align-middle"
          />
        ),
      )}
    </code>
  );
};

export default RuleExpressionText;
