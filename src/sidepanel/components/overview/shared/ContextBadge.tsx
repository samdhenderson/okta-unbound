import React from 'react';
import Icon, { type IconType } from './Icon';

type PageType = 'group' | 'user' | 'app' | 'admin' | 'unknown';

interface ContextBadgeProps {
  pageType: PageType;
  entityName?: string;
}

const badgeConfig: Record<PageType, {
  icon: IconType;
  label: string;
  gradient: string;
  textColor: string;
  bgColor: string;
}> = {
  group: {
    icon: 'users',
    label: 'Group',
    gradient: 'from-blue-500 to-blue-600',
    textColor: 'text-blue-700',
    bgColor: 'bg-blue-50',
  },
  user: {
    icon: 'user',
    label: 'User',
    gradient: 'from-purple-500 to-purple-600',
    textColor: 'text-purple-700',
    bgColor: 'bg-purple-50',
  },
  app: {
    icon: 'app',
    label: 'Application',
    gradient: 'from-emerald-500 to-emerald-600',
    textColor: 'text-emerald-700',
    bgColor: 'bg-emerald-50',
  },
  admin: {
    icon: 'building',
    label: 'Organization',
    gradient: 'from-gray-500 to-gray-600',
    textColor: 'text-gray-700',
    bgColor: 'bg-gray-50',
  },
  unknown: {
    icon: 'search',
    label: 'Unknown',
    gradient: 'from-gray-400 to-gray-500',
    textColor: 'text-gray-600',
    bgColor: 'bg-gray-50',
  },
};

const ContextBadge: React.FC<ContextBadgeProps> = ({ pageType, entityName }) => {
  const config = badgeConfig[pageType];

  return (
    <div className="flex items-center gap-3">
      <div className="inline-flex items-center gap-2.5 group">
        <div className={`
          p-2 rounded-xl bg-gradient-to-br ${config.gradient}
          shadow-md group-hover:shadow-lg transition-all duration-300
          transform group-hover:scale-105
        `}>
          <Icon type={config.icon} size="sm" className="text-white" />
        </div>
        <span className={`
          px-4 py-2 rounded-xl ${config.bgColor} ${config.textColor}
          text-sm font-bold tracking-wide
          border border-gray-200/50 shadow-sm
          transition-all duration-300 group-hover:shadow-md
        `}>
          {config.label}
        </span>
      </div>
      {entityName && (
        <div className="flex items-center gap-2">
          <div className="w-1 h-1 rounded-full bg-gray-300" />
          <span className="text-base font-semibold text-gray-900 tracking-tight">
            {entityName}
          </span>
        </div>
      )}
    </div>
  );
};

export default ContextBadge;
