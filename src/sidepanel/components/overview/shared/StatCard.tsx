/**
 * @module sidepanel/components/overview/shared/StatCard
 * @description Single metric tile (title, value, optional icon) used in the Overview stat grids.
 *
 * Presentational only: a colored, optionally clickable card. Numeric values are
 * localized with `toLocaleString`; the `color` prop selects an icon/border token set.
 */
import React from 'react';
import Icon, { type IconType } from './Icon';

/** Props for {@link StatCard}. */
interface StatCardProps {
  /** Uppercase label above the value. */
  title: string;
  /** The metric; numbers are rendered with thousands separators. */
  value: number | string;
  /** Semantic color, selecting the icon and border token set; defaults to `neutral`. */
  color?: 'primary' | 'success' | 'warning' | 'danger' | 'neutral';
  /** Optional icon shown at the top-right. */
  icon?: IconType;
  /** Optional caption below the value. */
  subtitle?: string;
  /** When provided, makes the card a clickable button. */
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
  danger: {
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

/** Renders one metric tile; the `color` prop maps to a token set in `colorConfigs`. */
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
    relative overflow-hidden rounded-md border p-4
    transition-all duration-100 ease-out
    ${config.cardBg} ${config.border}
    ${onClick ? 'cursor-pointer hover:border-neutral-300' : ''}
  `.trim();

  return (
    <div
      className={baseClasses}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      style={{ fontFamily: 'var(--font-primary)' }}
    >
      <div className="relative flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{title}</p>
          <p
            className={`mt-2 text-3xl font-bold ${config.textColor} tracking-tight truncate`}
            style={{ fontFamily: 'var(--font-primary)' }}
          >
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
          {subtitle && (
            <p className="mt-1.5 text-xs font-medium text-neutral-500 truncate">{subtitle}</p>
          )}
        </div>
        {icon && (
          <div className={`${config.iconBg} p-2.5 rounded-md flex-shrink-0`}>
            <Icon type={icon} className={config.iconColor} size="lg" />
          </div>
        )}
      </div>
    </div>
  );
};

export default StatCard;
