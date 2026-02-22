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
  primary: 'bg-primary hover:bg-primary-dark text-white shadow-sm disabled:opacity-50',
  secondary: 'bg-white hover:bg-neutral-50 text-neutral-700 border border-neutral-200 shadow-sm disabled:bg-neutral-50 disabled:text-neutral-400',
  danger: 'bg-danger hover:bg-danger text-white shadow-sm disabled:opacity-50',
  ghost: 'bg-transparent hover:bg-neutral-100 text-neutral-700 disabled:text-neutral-400',
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
          className="rounded-md border border-neutral-200 bg-white shadow-sm overflow-hidden transition-all duration-100"
        >
          {/* Section Header */}
          <button
            onClick={() => toggleSection(sectionIndex)}
            className="
              w-full flex items-center justify-between px-5 py-3.5
              text-left font-semibold text-neutral-900 bg-neutral-50
              hover:bg-neutral-100 transition-all duration-100
              border-b border-neutral-200
            "
          >
            <div className="flex items-center gap-3">
              {section.icon && (
                <div className="p-1.5 bg-white rounded-md shadow-sm">
                  <Icon type={section.icon} size="sm" className="text-neutral-600" />
                </div>
              )}
              <span className="text-sm font-semibold">{section.title}</span>
              <span className="px-2 py-0.5 bg-white rounded-full text-xs font-medium text-neutral-600 shadow-sm">
                {section.actions.length}
              </span>
            </div>
            <svg
              className={`
                w-5 h-5 text-neutral-400 transition-transform duration-100
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
            <div className="p-3 bg-white space-y-2">
              {section.actions.map((action, actionIndex) => (
                <button
                  key={actionIndex}
                  onClick={action.onClick}
                  disabled={action.disabled || action.loading}
                  title={action.tooltip}
                  className={`
                    w-full flex items-center justify-between px-4 py-3
                    rounded-md text-sm font-semibold transition-all duration-100
                    disabled:cursor-not-allowed disabled:opacity-50
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
                      bg-danger text-white shadow-sm
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
