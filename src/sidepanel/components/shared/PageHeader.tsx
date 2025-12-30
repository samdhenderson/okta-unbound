import React from 'react';
import Icon, { type IconType } from '../overview/shared/Icon';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: IconType;
  emoji?: string;
  actions?: React.ReactNode;
  badge?: {
    text: string;
    variant?: 'primary' | 'success' | 'warning' | 'error' | 'neutral';
  };
}

const badgeVariants = {
  primary: 'bg-gradient-to-r from-[#007dc1]/10 to-[#3d9dd9]/10 text-[#007dc1] border-[#007dc1]/20',
  success: 'bg-gradient-to-r from-emerald-500/10 to-emerald-600/10 text-emerald-600 border-emerald-200/40',
  warning: 'bg-gradient-to-r from-amber-500/10 to-amber-600/10 text-amber-600 border-amber-200/40',
  error: 'bg-gradient-to-r from-rose-500/10 to-rose-600/10 text-rose-600 border-rose-200/40',
  neutral: 'bg-gradient-to-r from-gray-500/10 to-gray-600/10 text-gray-600 border-gray-200/40',
};

const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  icon,
  emoji,
  actions,
  badge,
}) => {
  return (
    <div
      className="relative bg-white border-b border-gray-200 shadow-sm"
      style={{ fontFamily: 'var(--font-primary)' }}
    >

      <div className="relative px-6 py-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          {/* Icon or Emoji */}
          {(icon || emoji) && (
            <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-[#007dc1]/10 to-[#3d9dd9]/10 border border-[#007dc1]/20 flex items-center justify-center shadow-sm ring-1 ring-black/5">
              {icon ? (
                <Icon type={icon} size="lg" className="text-[#007dc1]" />
              ) : (
                <span className="text-2xl">{emoji}</span>
              )}
            </div>
          )}

          {/* Title and subtitle */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                {title}
              </h1>
              {badge && (
                <span
                  className={`
                    px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider
                    border backdrop-blur-sm shadow-sm
                    ${badgeVariants[badge.variant || 'neutral']}
                  `}
                >
                  {badge.text}
                </span>
              )}
            </div>
            {subtitle && (
              <p className="mt-1.5 text-sm text-gray-600 font-medium leading-relaxed">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        {actions && (
          <div className="flex-shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};

export default PageHeader;
