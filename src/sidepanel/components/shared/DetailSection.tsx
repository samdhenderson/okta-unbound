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
 */
import React from 'react';

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
  /** Section body. */
  children: React.ReactNode;
}

/**
 * One card-shaped section of a detail view.
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
 */
const DetailSection: React.FC<DetailSectionProps> = ({
  title,
  description,
  actions,
  band,
  headingId,
  children,
}) => {
  // The header row exists if anything would go in it. `actions` alone is a real
  // case (an untitled pane with a gate button), so this is not just `!!title`.
  const hasHeader = Boolean(title || description || actions);

  return (
    <section
      // Only meaningful with a heading to point at; a section with no accessible
      // name is not exposed as a region, which is the right answer for a pane
      // card whose `role="tabpanel"` host already carries the name.
      aria-labelledby={title ? headingId : undefined}
      className={`rounded-md border border-neutral-200 bg-white${band ? ' overflow-hidden' : ''}`}
    >
      {band && <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3">{band}</div>}
      {/* The padding lives here rather than on the `<section>` so the band above
          can reach the card's edges. For a band-less section the box model is
          identical to what it was when the padding sat on the section itself. */}
      <div className="px-4 py-3">
        {hasHeader && (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {title && (
                <h2
                  id={headingId}
                  className="text-xs font-semibold uppercase tracking-wide text-neutral-600"
                  style={{ fontFamily: 'var(--font-heading)' }}
                >
                  {title}
                </h2>
              )}
              {description && <p className="mt-1 text-xs text-neutral-500">{description}</p>}
            </div>
            {actions && <div className="shrink-0">{actions}</div>}
          </div>
        )}
        <div className={hasHeader ? 'mt-3' : undefined}>{children}</div>
      </div>
    </section>
  );
};

export default DetailSection;
