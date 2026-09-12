/**
 * @module sidepanel/components/shared/DetailSection
 * @description White card wrapper for one section of a detail view (ADR-0030).
 *
 * A section is an optional eyebrow heading, an optional one-line explanation, an
 * optional trailing header slot, an optional full-bleed band, and a body.
 * Elevation comes from the 1px border alone, per the Odyssey surface model — no
 * drop shadow on cards.
 *
 * Originally scoped to the Group Detail view; promoted to the shared barrel when
 * the detail pages adopted one layout language, because it was already the only
 * section primitive in the codebase and four other surfaces were hand-rolling
 * near-copies of it with a drifting eyebrow (`tracking-wider` in `RuleCard` and
 * `PolicyCard` against `tracking-wide` here). This is the version that wins.
 *
 * ## What belongs in `actions`
 *
 * A verb **scoped to this section's data** — a gate button that loads it, a
 * control that mutates it, a count of it. A verb whose object is the whole page
 * belongs in `ActionBar` instead. The split is not cosmetic: a page-level slot has
 * no view of whether this section's data is loaded, so putting "Add member" up
 * there would let a reader mutate a list that is still behind its gate.
 *
 * ## Why `title` is optional
 *
 * A tab already names its pane. A section titled "Members" inside a tab labelled
 * "Members" is the tab-level echo of ADR-0032's *the header describes the entity;
 * the body must not repeat it* — so a tab whose whole content is one section
 * renders that section untitled, and a tab holding several titles each of them.
 * Omitting the title drops the header row entirely rather than rendering an empty
 * one, so the body sits at the card's own padding.
 *
 * ## Why `band` is a slot here and not markup at the call site
 *
 * A filter band (search + pills + a meter) has to reach the card's left and right
 * edges to read as chrome rather than as one of the section's contents. A call
 * site cannot do that from inside the body: the body is padded, so a band nested
 * there either stops short of the edge or claws its way out with a negative
 * margin. `GroupMembershipsList` reached the edge only because its host owned the
 * card and the pane itself was chromeless, and its own comment records what
 * happened the one time both had chrome:
 *
 * > "A card here too made a box inside a box, briefly patched at the call site
 * > with a `-m-px` that pulled this border under the parent's `overflow-hidden`.
 * > Deleting the chrome is the fix; hiding a duplicate border is not."
 *
 * So the card holds the padding boundary and the band sits outside it, above the
 * body, with the section supplying `overflow-hidden` so the band's top corners
 * clip against the radius. That `overflow-hidden` is applied **only** when a band
 * is present — a section without one keeps the box model it has always had, so
 * nothing that currently relies on overflowing its card (a popover, a sticky
 * child) starts clipping because this prop was added.
 *
 * ## The disclosure is a capability of this card, not a second card
 *
 * `collapsible` turns the heading into a real `<button>` and folds the body into
 * the shared `.disclose` wrapper. It exists here rather than in
 * `CollapsibleSection` because that component's *entire header* is one `<button>`
 * — so it can carry a title and a count and nothing else. A section that folds
 * **and** owns a gate button (the Insights tab's "Attribute spread", with its
 * `Analyze` action) cannot be built there without nesting a button inside a
 * button. Here the trigger is scoped to the heading and `description`/`actions`
 * stay beside it, outside the control.
 *
 * Every disclosure prop is additive: a call site that passes none of them renders
 * exactly the markup it always did, down to the box model.
 *
 * ## A folded section still answers something
 *
 * `summary` sits in the always-visible header, below the description. A stack of
 * sections that all start closed is otherwise a column of bare headers, and a
 * reader has to open each one to find out whether it was worth opening. The
 * summary is the section's headline fact, stated where it can be read without a
 * click — and it is subject to the same rule as everything else: a fact that has
 * not loaded is named as absent, never rendered as a `0`.
 */
import React, { useId, useState } from 'react';
import Badge from './Badge';
import Icon from './Icon';

/** Props for {@link DetailSection}. */
export interface DetailSectionProps {
  /**
   * Section heading, rendered as an uppercase eyebrow `<h2>`. Omit when the
   * surrounding tab already names this content — see the module docs.
   */
  title?: string;
  /** Optional one-line explanation under the heading. */
  description?: string;
  /** Optional right-aligned header node (a count badge, a gated action button). */
  actions?: React.ReactNode;
  /**
   * Optional full-bleed band rendered above the body, spanning the card's full
   * width with its own separator — the home for a section's filter chrome
   * (search field, filter pills, a source meter). Supply the band's contents
   * only; the padding, background and bottom border are this component's.
   */
  band?: React.ReactNode;
  /**
   * Id for the heading element, so a body region can point at it with
   * `aria-labelledby`. Optional — omit when the body needs no explicit label.
   * Ignored when there is no `title` to hang it on.
   */
  headingId?: string;
  /**
   * Fold the body behind the heading. Requires `title` — the heading text is the
   * trigger's accessible name, and a disclosure with no name is not operable by
   * anybody reading the control rather than the card. Passing `collapsible`
   * without a `title` renders the ordinary, non-folding section.
   *
   * The body stays **mounted** while collapsed (held out of the tab order and the
   * accessibility tree with `inert`), so a folded section keeps its own state —
   * don't rely on collapsing to reset it.
   */
  collapsible?: boolean;
  /** Whether a `collapsible` section starts expanded. Defaults to `true`. */
  defaultOpen?: boolean;
  /** Optional count rendered as a badge beside the title. */
  itemCount?: number;
  /**
   * The section's headline fact, kept visible whether the section is open or
   * closed. Only worth supplying on a `collapsible` section — see the module docs.
   */
  summary?: React.ReactNode;
  /** Section body. */
  children: React.ReactNode;
}

/**
 * One card-shaped section of a detail view, optionally folding behind its heading.
 *
 * @param props - See {@link DetailSectionProps}.
 *
 * @example
 * ```tsx
 * <DetailSection title="App push" description="Where this group's members are provisioned.">
 *   <PushMappingList mappings={group.pushMappings ?? []} />
 * </DetailSection>
 * ```
 *
 * @example Untitled, with a full-bleed filter band — a tab whose whole body is one section.
 * ```tsx
 * <DetailSection band={<MemberFilterBand {...filterProps} />}>
 *   <MemberList members={visible} />
 * </DetailSection>
 * ```
 *
 * @example Folded, with a gate button beside the trigger and a headline fact under it.
 * ```tsx
 * <DetailSection
 *   title="Attribute spread"
 *   collapsible
 *   defaultOpen={false}
 *   itemCount={ranked.length}
 *   summary={<p className="text-xs text-neutral-600">11 attributes · 3 flagged</p>}
 *   actions={<Button size="sm">Analyze</Button>}
 * >
 *   <AttributeGrid entries={ranked} />
 * </DetailSection>
 * ```
 */
const DetailSection: React.FC<DetailSectionProps> = ({
  title,
  description,
  actions,
  band,
  headingId,
  collapsible = false,
  defaultOpen = true,
  itemCount,
  summary,
  children,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const bodyId = useId();

  // A disclosure with no heading has no accessible name, so `collapsible` alone
  // is not enough to build the trigger — a titleless section stays open.
  const discloses = collapsible && Boolean(title);

  // The header row exists if anything would go in it. `actions` alone is a real
  // case (an untitled pane with a gate button), so this is not just `!!title`.
  const hasHeader = Boolean(title || description || actions || itemCount !== undefined);

  const count =
    itemCount !== undefined ? (
      <Badge variant="neutral" testId="detail-section-count">
        {itemCount}
      </Badge>
    ) : null;

  const heading = title ? (
    <h2
      id={headingId}
      className="text-xs font-semibold uppercase tracking-wide text-neutral-600"
      style={{ fontFamily: 'var(--font-heading)' }}
    >
      {discloses ? (
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls={bodyId}
          onClick={() => setIsOpen((open) => !open)}
          className="flex items-center gap-(--sp-inline) text-left uppercase tracking-wide"
        >
          <Icon
            type="chevron-right"
            size="sm"
            aria-hidden="true"
            className={`shrink-0 text-neutral-400 transition-transform duration-(--dur-quick) ease-standard ${
              isOpen ? 'rotate-90' : ''
            }`}
          />
          <span>{title}</span>
          {count}
        </button>
      ) : (
        <span className="flex items-center gap-(--sp-inline)">
          <span>{title}</span>
          {count}
        </span>
      )}
    </h2>
  ) : null;

  const header = hasHeader ? (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        {heading}
        {description && <p className="mt-1 text-xs text-neutral-500">{description}</p>}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  ) : null;

  return (
    <section
      // Only meaningful with a heading to point at; a section with no accessible
      // name is not exposed as a region, which is the right answer for a pane
      // card whose `role="tabpanel"` host already carries the name.
      aria-labelledby={title ? headingId : undefined}
      className={`rounded-md border border-neutral-200 bg-white${band ? ' overflow-hidden' : ''}`}
    >
      {band && <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3">{band}</div>}
      {discloses ? (
        <>
          {/* The header keeps its own padding so the disclosed body below can
              own — and clip — the rest. */}
          <div className="px-4 py-3">
            {header}
            {summary && <div className="mt-2">{summary}</div>}
          </div>
          {/*
            `.disclose` animates `grid-template-rows` between 1fr and 0fr, so the
            body collapses to zero height with no JS measurement (and without
            toggling `display`, which cannot be transitioned). Its direct child is
            the CSS-owned clipping row — the padding lives one level further in so
            it is clipped with the content instead of holding the row open.
          */}
          <div id={bodyId} className="disclose" data-open={isOpen} inert={!isOpen || undefined}>
            <div>
              <div className="px-4 pb-3">{children}</div>
            </div>
          </div>
        </>
      ) : (
        /* The padding lives here rather than on the `<section>` so the band above
           can reach the card's edges. For a band-less section the box model is
           identical to what it was when the padding sat on the section itself. */
        <div className="px-4 py-3">
          {header}
          {summary && <div className="mt-2">{summary}</div>}
          <div className={hasHeader || summary ? 'mt-3' : undefined}>{children}</div>
        </div>
      )}
    </section>
  );
};

export default DetailSection;
