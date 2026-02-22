import React from 'react';
import Icon, { type IconType } from './Icon';

interface StatCardProps {
  title: string;
  value: number | string;
  color?: 'primary' | 'success' | 'warning' | 'error' | 'neutral';
  icon?: IconType;
  subtitle?: string;
  onClick?: () => void;
}

const colorConfigs = {
  primary: {
    iconBg: 'bg-primary-light',
    iconColor: 'text-primary-text',
    cardBg: 'bg-white',
    border: 'border-primary-highlight',
    textColor: 'text-neutral-900',
  },
  success: {
    iconBg: 'bg-success-light',
    iconColor: 'text-success-text',
    cardBg: 'bg-white',
    border: 'border-neutral-200',
    textColor: 'text-neutral-900',
  },
  warning: {
    iconBg: 'bg-warning-light',
    iconColor: 'text-warning-text',
    cardBg: 'bg-white',
    border: 'border-neutral-200',
    textColor: 'text-neutral-900',
  },
  error: {
    iconBg: 'bg-danger-light',
    iconColor: 'text-danger-text',
    cardBg: 'bg-white',
    border: 'border-neutral-200',
    textColor: 'text-neutral-900',
  },
  neutral: {
    iconBg: 'bg-neutral-100',
    iconColor: 'text-neutral-600',
    cardBg: 'bg-white',
    border: 'border-neutral-200',
    textColor: 'text-neutral-900',
  },
};

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  color = 'neutral',
  icon,
  subtitle,
  onClick,
}) => {
  const config = colorConfigs[color];

  const baseClasses = `
    relative overflow-hidden rounded-md border p-6
    transition-all duration-100 ease-out
    ${config.cardBg} ${config.border}
    ${onClick ? 'cursor-pointer hover:shadow-sm' : ''}
    shadow-sm
  `.trim();

  return (
    <div
      className={baseClasses}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      style={{ fontFamily: 'var(--font-primary)' }}
    >
      <div className="relative flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-bold uppercase tracking-widest ${config.textColor} opacity-60`}>
            {title}
          </p>
          <p className={`mt-3 text-4xl font-bold ${config.textColor} tracking-tight`} style={{ fontFamily: 'var(--font-primary)' }}>
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
          {subtitle && (
            <p className={`mt-2.5 text-xs font-medium ${config.textColor} opacity-70`}>
              {subtitle}
            </p>
          )}
        </div>
        {icon && (
          <div className={`${config.iconBg} p-3.5 rounded-md shadow-sm ring-1 ring-black/5`}>
            <Icon type={icon} className={config.iconColor} size="lg" />
          </div>
        )}
      </div>
    </div>
  );
};

export default StatCard;
