/**
 * @module sidepanel/components/shared/CollapsibleSection
 * @description Bordered card whose header toggles the body open/closed.
 *
 * Manages its own open/closed state internally (uncontrolled), seeded by
 * `defaultOpen`. A chevron rotates and an optional count badge shows in the header.
 *
 * The body height animates via the shared `.disclose` grid wrapper
 * (`grid-template-rows: 0fr → 1fr`, no JS measurement), so children stay mounted
 * while collapsed — held out of the tab order and the accessible tree with
 * `inert` rather than unmounted.
 */
import React, { useId, useState } from 'react';

interface CollapsibleSectionProps {
  /** Header label. */
  title: string;
  /** Whether the section starts expanded. Defaults to `true`. */
  defaultOpen?: boolean;
  /**
   * Body content. Stays mounted while the section is collapsed (hidden by the
   * `.disclose` height animation and made `inert`), so it keeps its own state —
   * don't rely on collapsing to reset or unmount it.
   */
  children: React.ReactNode;
  /** Optional count rendered as a small badge next to the title. */
  itemCount?: number;
}

/**
 * A collapsible section with a clickable header that expands/collapses its body.
 * Open state is managed internally (uncontrolled). The header button carries
 * `aria-expanded`/`aria-controls` for the body region, whose height animates
 * rather than snapping.
 *
 * @example
 * ```tsx
 * <CollapsibleSection title="Advanced filters" itemCount={activeFilters.length}>
 *   <FilterControls />
 * </CollapsibleSection>
 * ```
 */
const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  defaultOpen = true,
  children,
  itemCount,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const bodyId = useId();

  return (
    <div className="rounded-md border border-neutral-200 bg-white overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-5 py-3.5 text-left font-semibold text-neutral-900 bg-white hover:bg-neutral-50 transition-colors duration-(--dur-instant) border-b border-neutral-200"
        onClick={() => setIsOpen(!isOpen)}
        type="button"
        aria-expanded={isOpen}
        aria-controls={bodyId}
      >
        <div className="flex items-center gap-3">
          <svg
            className={`w-4 h-4 text-neutral-400 transition-transform duration-(--dur-instant) ease-standard ${isOpen ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-sm font-semibold">{title}</span>
          {itemCount !== undefined && (
            <span className="px-2 py-0.5 bg-neutral-50 rounded-md text-xs font-medium text-neutral-600 border border-neutral-200">
              {itemCount}
            </span>
          )}
        </div>
      </button>
      {/*
        `.disclose` animates `grid-template-rows` between 0fr and 1fr, so the body
        collapses to zero height without any JS measurement (and without toggling
        `display`, which cannot be transitioned). Its direct child is the CSS-owned
        clipping row — the padding lives one level further in so it is clipped with
        the content instead of holding the row open.
      */}
      <div id={bodyId} className="disclose" data-open={isOpen} inert={!isOpen || undefined}>
        <div>
          <div className="p-5">{children}</div>
        </div>
      </div>
    </div>
  );
};

export default CollapsibleSection;
