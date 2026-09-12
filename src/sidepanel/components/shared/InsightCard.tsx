/**
 * @module sidepanel/components/shared/InsightCard
 * @description The anatomy every card on an insights surface shares: a name, the
 * badges saying why it ranks where it does, a headline that reads without a
 * click, and one disclosure holding the detail.
 *
 * Extracted from `AttributeHealthCard`, which was the only card with this shape
 * until the MFA coverage scan grew from one sentence into a pair of reports. The
 * two now describe different subjects with the same anatomy, which is the point:
 * a reader learns one card and reads the whole surface with it.
 *
 * ## One anatomy, ranked
 *
 * Severity is carried by **order** and by **badges**, never by giving a flagged
 * card a different shape. A second card shape for "bad" ones would mean a reader
 * learns two layouts and then has to diff them; it also quietly asserts that the
 * quiet ones are a different kind of thing, when the only difference is that
 * today nothing is wrong with them.
 *
 * ## The badges survive the collapse
 *
 * `badges` render in **both** stages. A collapsed card that hid its reasons would
 * leave the ranking looking arbitrary: the reader sees an order with no visible
 * cause and has to open cards to find out why. Each badge should be a phrase
 * rather than a bare number, and none of them should depend on its colour to be
 * understood.
 *
 * ## The disclosure is a real control
 *
 * The header is covered by a {@link StretchedButton} carrying `aria-expanded` and
 * `aria-controls` — a real `<button>`, focusable, Enter/Space operable. The
 * overlay is scoped to the header, not the whole card, so clicking inside the
 * body it just opened does not collapse it. The body stays mounted and `inert`
 * while collapsed, so nothing inside it resets when a reader folds the card.
 *
 * The control's name carries its **subject**, not just its verb: a surface
 * renders a grid of these, and `aria-describedby` is a description rather than a
 * name — so without the subject every card's control would be called the same
 * thing in a list of names.
 */
import React, { useId, useState } from 'react';
import ListRow from './ListRow';
import StretchedButton from './StretchedButton';
import Icon from './Icon';

/** Props for {@link InsightCard}. */
export interface InsightCardProps {
  /**
   * The card's name, as a node — a `<code>` for an attribute key, plain text for
   * a report. Given the `titleId` so the disclosure can point at it.
   */
  title: (titleId: string) => React.ReactNode;
  /**
   * Plain-text subject for the disclosure's accessible name, e.g. `department`.
   * Required because a grid of these otherwise names every control identically.
   */
  subject: string;
  /**
   * What the disclosure reveals, as a noun phrase — `"value breakdown"`,
   * `"factor list"`. Composed into "Show the {revealName} for {subject}".
   */
  revealName: string;
  /**
   * Why this card ranks where it does. Rendered in **every** stage, collapsed
   * included. Omit when nothing is flagged — an empty strip is an answer, and
   * renders as no strip rather than as an empty one.
   */
  badges?: React.ReactNode;
  /**
   * The always-visible summary under the badges — a spread bar, a count line, or
   * both. This is what a collapsed card is read for.
   */
  headline?: React.ReactNode;
  /** The disclosed body. */
  children: React.ReactNode;
  /** Starts the card expanded. For stories and tests; surfaces open cards on demand. */
  defaultExpanded?: boolean;
}

/**
 * One insight: its name, why it is worth reading, a headline that needs no click,
 * and the detail one disclosure down.
 *
 * @example
 * ```tsx
 * <InsightCard
 *   title={(id) => <code id={id}>{summary.key}</code>}
 *   subject={summary.key}
 *   revealName="value breakdown"
 *   badges={<SignalBadges signals={signals} />}
 *   headline={<AttributeSpreadBar rows={summary.rows} />}
 * >
 *   <ValueList rows={summary.rows} />
 * </InsightCard>
 * ```
 *
 * @param props - See {@link InsightCardProps}.
 */
const InsightCard: React.FC<InsightCardProps> = ({
  title,
  subject,
  revealName,
  badges,
  headline,
  children,
  defaultExpanded = false,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const bodyId = useId();
  const titleId = useId();

  return (
    <ListRow
      headerClassName="relative"
      body={
        // `.disclose` animates `grid-template-rows` 0fr → 1fr with no JS
        // measurement — and honours reduced motion through the global token
        // contract rather than a check here. `inert` keeps the closed body out of
        // the tab order and the accessibility tree.
        <div id={bodyId} className="disclose" data-open={expanded} inert={!expanded || undefined}>
          <div>
            <div className="space-y-3 border-t border-neutral-100 px-(--sp-card) pb-(--sp-card) pt-3">
              {children}
            </div>
          </div>
        </div>
      }
    >
      <StretchedButton
        label={`${expanded ? 'Hide' : 'Show'} the ${revealName} for ${subject}`}
        describedBy={titleId}
        expanded={expanded}
        controls={bodyId}
        onClick={() => setExpanded((open) => !open)}
      />

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-(--sp-inline)">
          {title(titleId)}
          <Icon
            type="chevron-right"
            size="sm"
            aria-hidden="true"
            className={`shrink-0 text-neutral-400 transition-transform duration-(--dur-quick) ${
              expanded ? 'rotate-90' : ''
            }`}
          />
        </div>

        {/* Stage one keeps the badges. Without them the order the surface put
          these cards in has no visible cause. */}
        {badges}

        {headline}
      </div>
    </ListRow>
  );
};

export default InsightCard;
