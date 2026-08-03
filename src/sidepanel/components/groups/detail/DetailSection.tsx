/**
 * @module sidepanel/components/groups/detail/DetailSection
 * @description White card wrapper for one section of the Group Detail view.
 *
 * A section is an eyebrow heading, an optional one-line explanation, an optional
 * trailing header slot (a count, a gated action), and a body. Elevation comes from
 * the 1px border alone, per the Odyssey surface model — no drop shadow on cards.
 */
import React from 'react';

/** Props for {@link DetailSection}. */
interface DetailSectionProps {
  /** Section heading, rendered as an uppercase eyebrow `<h2>`. */
  title: string;
  /** Optional one-line explanation under the heading. */
  description?: string;
  /** Optional right-aligned header node (a count badge, a gated action button). */
  actions?: React.ReactNode;
  /**
   * Id for the heading element, so a body region can point at it with
   * `aria-labelledby`. Optional — omit when the body needs no explicit label.
   */
  headingId?: string;
  /** Section body. */
  children: React.ReactNode;
}

/**
 * One card-shaped section of the Group Detail view.
 *
 * @example
 * ```tsx
 * <DetailSection title="App push" description="Where this group's members are provisioned.">
 *   <PushMappingList mappings={group.pushMappings ?? []} />
 * </DetailSection>
 * ```
 */
const DetailSection: React.FC<DetailSectionProps> = ({
  title,
  description,
  actions,
  headingId,
  children,
}) => (
  <section
    aria-labelledby={headingId}
    className="rounded-md border border-neutral-200 bg-white px-4 py-3"
  >
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2
          id={headingId}
          className="text-xs font-semibold uppercase tracking-wide text-neutral-600"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          {title}
        </h2>
        {description && <p className="mt-1 text-xs text-neutral-500">{description}</p>}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
    <div className="mt-3">{children}</div>
  </section>
);

export default DetailSection;
