import React, { useState } from 'react';
import Icon, { type IconType } from './Icon';

export interface ActionButton {
  label: string;
  icon?: IconType;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  badge?: string;
  tooltip?: string;
}

export interface ActionSection {
  title: string;
  icon?: IconType;
  expanded?: boolean;
  actions: ActionButton[];
}

interface QuickActionsPanelProps {
  sections: ActionSection[];
  className?: string;
}

const variantClasses = {
  primary: 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-md hover:shadow-lg disabled:from-blue-300 disabled:to-blue-400',
  secondary: 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 shadow-sm hover:shadow disabled:bg-gray-50 disabled:text-gray-400',
  danger: 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white shadow-md hover:shadow-lg disabled:from-red-300 disabled:to-red-400',
  ghost: 'bg-transparent hover:bg-gray-100/80 text-gray-700 disabled:text-gray-400',
};

const QuickActionsPanel: React.FC<QuickActionsPanelProps> = ({ sections, className = '' }) => {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(
    sections.reduce((acc, section, index) => ({
      ...acc,
      [index]: section.expanded !== false, // Default to expanded
    }), {})
  );

  const toggleSection = (index: number) => {
    setExpandedSections(prev => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {sections.map((section, sectionIndex) => (
        <div
          key={sectionIndex}
          className="rounded-xl border border-gray-200/80 bg-white shadow-sm hover:shadow-md overflow-hidden transition-all duration-300"
        >
          {/* Section Header */}
          <button
            onClick={() => toggleSection(sectionIndex)}
            className="
              w-full flex items-center justify-between px-5 py-3.5
              text-left font-semibold text-gray-900 bg-gradient-to-r from-gray-50 to-gray-100/50
              hover:from-gray-100 hover:to-gray-200/50 transition-all duration-200
              border-b border-gray-200/50
            "
          >
            <div className="flex items-center gap-3">
              {section.icon && (
                <div className="p-1.5 bg-white rounded-lg shadow-sm">
                  <Icon type={section.icon} size="sm" className="text-gray-600" />
                </div>
              )}
              <span className="text-sm font-semibold">{section.title}</span>
              <span className="px-2 py-0.5 bg-white rounded-full text-xs font-medium text-gray-600 shadow-sm">
                {section.actions.length}
              </span>
            </div>
            <svg
              className={`
                w-5 h-5 text-gray-400 transition-transform duration-300
                ${expandedSections[sectionIndex] ? 'rotate-180' : ''}
              `}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Section Content */}
          {expandedSections[sectionIndex] && (
            <div className="p-3 bg-gradient-to-b from-white to-gray-50/30 space-y-2">
              {section.actions.map((action, actionIndex) => (
                <button
                  key={actionIndex}
                  onClick={action.onClick}
                  disabled={action.disabled || action.loading}
                  title={action.tooltip}
                  className={`
                    w-full flex items-center justify-between px-4 py-3
                    rounded-lg text-sm font-semibold transition-all duration-200
                    disabled:cursor-not-allowed disabled:opacity-50
                    transform hover:scale-[1.01]
                    ${variantClasses[action.variant || 'secondary']}
                  `}
                >
                  <div className="flex items-center gap-3">
                    {action.loading ? (
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    ) : action.icon ? (
                      <Icon type={action.icon} size="sm" />
                    ) : null}
                    <span>{action.label}</span>
                  </div>
                  {action.badge && (
                    <span className="
                      ml-2 px-2.5 py-1 rounded-full text-xs font-bold
                      bg-gradient-to-r from-red-500 to-red-600 text-white shadow-sm
                    ">
                      {action.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default QuickActionsPanel;
