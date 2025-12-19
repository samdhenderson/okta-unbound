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
    gradient: 'from-[#007dc1] to-[#3d9dd9]',
    iconBg: 'bg-gradient-to-br from-[#007dc1]/10 to-[#3d9dd9]/10',
    iconColor: 'text-[#007dc1]',
    cardBg: 'bg-gradient-to-br from-white to-[#e6f4fa]/30',
    border: 'border-[#007dc1]/20',
    textColor: 'text-gray-900',
    shadow: 'shadow-[#007dc1]/10',
  },
  success: {
    gradient: 'from-emerald-500 to-emerald-600',
    iconBg: 'bg-gradient-to-br from-emerald-500/10 to-emerald-600/10',
    iconColor: 'text-emerald-600',
    cardBg: 'bg-gradient-to-br from-white to-emerald-50/50',
    border: 'border-emerald-200/40',
    textColor: 'text-gray-900',
    shadow: 'shadow-emerald-500/10',
  },
  warning: {
    gradient: 'from-amber-500 to-amber-600',
    iconBg: 'bg-gradient-to-br from-amber-500/10 to-amber-600/10',
    iconColor: 'text-amber-600',
    cardBg: 'bg-gradient-to-br from-white to-amber-50/50',
    border: 'border-amber-200/40',
    textColor: 'text-gray-900',
    shadow: 'shadow-amber-500/10',
  },
  error: {
    gradient: 'from-rose-500 to-rose-600',
    iconBg: 'bg-gradient-to-br from-rose-500/10 to-rose-600/10',
    iconColor: 'text-rose-600',
    cardBg: 'bg-gradient-to-br from-white to-rose-50/50',
    border: 'border-rose-200/40',
    textColor: 'text-gray-900',
    shadow: 'shadow-rose-500/10',
  },
  neutral: {
    gradient: 'from-gray-500 to-gray-600',
    iconBg: 'bg-gradient-to-br from-gray-500/10 to-gray-600/10',
    iconColor: 'text-gray-600',
    cardBg: 'bg-gradient-to-br from-white to-gray-50/50',
    border: 'border-gray-200/40',
    textColor: 'text-gray-900',
    shadow: 'shadow-gray-500/10',
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
    relative overflow-hidden rounded-xl border p-6
    transition-all duration-300 ease-out
    ${config.cardBg} ${config.border} ${config.shadow}
    ${onClick ? 'cursor-pointer hover:shadow-xl hover:scale-[1.02] hover:-translate-y-0.5' : 'hover:shadow-lg'}
    shadow-lg backdrop-blur-sm
  `.trim();

  return (
    <div
      className={baseClasses}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      style={{ fontFamily: 'var(--font-primary)' }}
    >
      {/* Enhanced gradient overlay with glow */}
      <div className={`absolute top-0 right-0 w-40 h-40 bg-gradient-to-br ${config.gradient} opacity-[0.08] rounded-full blur-3xl -translate-y-1/2 translate-x-1/2`} />

      {/* Subtle edge highlight */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent" />

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
          <div className={`${config.iconBg} p-3.5 rounded-xl shadow-sm ring-1 ring-black/5`}>
            <Icon type={icon} className={config.iconColor} size="lg" />
          </div>
        )}
      </div>
    </div>
  );
};

export default StatCard;
