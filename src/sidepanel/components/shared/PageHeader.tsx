import React from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  badge?: {
    text: string;
    variant?: 'primary' | 'success' | 'warning' | 'error' | 'neutral';
  };
}

const badgeVariants = {
  primary: 'bg-primary-light text-primary-text border-primary-highlight',
  success: 'bg-success-light text-success-text border-success-light',
  warning: 'bg-warning-light text-warning-text border-warning-light',
  error: 'bg-danger-light text-danger-text border-danger-light',
  neutral: 'bg-neutral-50 text-neutral-600 border-neutral-200',
};

const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  actions,
  badge,
}) => {
  return (
    <div className="bg-white border-b border-neutral-200">
      <div className="px-5 py-4 flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-neutral-900" style={{ fontFamily: 'var(--font-heading)' }}>{title}</h1>
            {badge && (
              <span className={`px-2 py-0.5 rounded-md text-xs font-medium border ${badgeVariants[badge.variant || 'neutral']}`}>
                {badge.text}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="mt-0.5 text-sm text-neutral-600">{subtitle}</p>
          )}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
    </div>
  );
};

export default PageHeader;
