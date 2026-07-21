/**
 * @module sidepanel/components/shared/CollapsibleSection
 * @description Bordered card whose header toggles the body open/closed.
 *
 * Manages its own open/closed state internally (uncontrolled), seeded by
 * `defaultOpen`. A chevron rotates and an optional count badge shows in the header.
 */
import React, { useState } from 'react';

interface CollapsibleSectionProps {
  /** Header label. */
  title: string;
  /** Whether the section starts expanded. Defaults to `true`. */
  defaultOpen?: boolean;
  /** Body content, rendered only while expanded. */
  children: React.ReactNode;
  /** Optional count rendered as a small badge next to the title. */
  itemCount?: number;
}

/**
 * A collapsible section with a clickable header that expands/collapses its body.
 * Open state is managed internally (uncontrolled).
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

  return (
    <div className="rounded-md border border-neutral-200 bg-white overflow-hidden transition-all duration-100">
      <button
        className="w-full flex items-center justify-between px-5 py-3.5 text-left font-semibold text-neutral-900 bg-white hover:bg-neutral-50 transition-all duration-100 border-b border-neutral-200"
        onClick={() => setIsOpen(!isOpen)}
        type="button"
      >
        <div className="flex items-center gap-3">
          <svg
            className={`w-4 h-4 text-neutral-400 transition-transform duration-100 ${isOpen ? 'rotate-90' : ''}`}
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
      {isOpen && <div className="p-5">{children}</div>}
    </div>
  );
};

export default CollapsibleSection;
