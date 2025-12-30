import React from 'react';

interface QuickStatsCardProps {
  title: string;
  value: number | string;
  trend?: number;
  color?: 'primary' | 'success' | 'warning' | 'error';
}

const QuickStatsCard: React.FC<QuickStatsCardProps> = ({ title, value, trend, color = 'primary' }) => {
  const colorClass = color === 'warning' ? 'warning' : '';

  return (
    <div className={`stat-card ${colorClass}`}>
      <div className={`stat-value ${color === 'success' ? 'stat-success' : color === 'warning' ? 'stat-warning' : ''}`}>
        {value}
        {trend !== undefined && trend !== 0 && (
          <span style={{ fontSize: '14px', marginLeft: '6px', opacity: 0.7 }}>
            {trend > 0 ? `+${trend}` : trend}
          </span>
        )}
      </div>
      <div className="stat-label">{title}</div>
    </div>
  );
};

export default QuickStatsCard;
