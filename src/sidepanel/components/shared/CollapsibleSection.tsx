import React, { useState } from 'react';

interface CollapsibleSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  itemCount?: number;
}

/**
 * A collapsible section component with a header that can be clicked to expand/collapse.
 * Used for organizing content into expandable groups.
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
        className="w-full flex items-center justify-between px-5 py-3.5 text-left font-semibold text-neutral-900 bg-neutral-50 hover:bg-neutral-100 transition-all duration-100 border-b border-neutral-200"
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
            <span className="px-2 py-0.5 bg-white rounded-md text-xs font-medium text-neutral-600 border border-neutral-200">
              {itemCount}
            </span>
          )}
        </div>
      </button>
      {isOpen && (
        <div className="p-5">
          {children}
        </div>
      )}
    </div>
  );
};

export default CollapsibleSection;
