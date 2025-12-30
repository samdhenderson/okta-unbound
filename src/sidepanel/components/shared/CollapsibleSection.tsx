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
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md">
      <button
        className="w-full flex items-center justify-between px-5 py-3.5 text-left font-semibold text-gray-900 bg-gradient-to-r from-gray-50 to-gray-100/50 hover:from-gray-100 hover:to-gray-200/50 transition-all duration-200 border-b border-gray-200/50"
        onClick={() => setIsOpen(!isOpen)}
        type="button"
      >
        <div className="flex items-center gap-3">
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-sm font-semibold">{title}</span>
          {itemCount !== undefined && (
            <span className="px-2 py-0.5 bg-white rounded-full text-xs font-medium text-gray-600 shadow-sm">
              {itemCount}
            </span>
          )}
        </div>
      </button>
      {isOpen && (
        <div className="p-5 bg-gradient-to-b from-white to-gray-50/30 animate-in slide-in-from-top-2 duration-300">
          {children}
        </div>
      )}
    </div>
  );
};

export default CollapsibleSection;
