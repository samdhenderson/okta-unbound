import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import type { UserStatus } from '../../../shared/types';
import { getUserFriendlyStatus } from '../../../shared/utils/statusNormalizer';

interface StatusPieChartProps {
  statusBreakdown: Record<UserStatus, number>;
}

const STATUS_COLORS: Record<UserStatus, string> = {
  ACTIVE: '#4a934e',
  DEPROVISIONED: '#c94a3f',
  SUSPENDED: '#d4880f',
  LOCKED_OUT: '#ef5350',
  STAGED: '#3b82a6',
  PROVISIONED: '#007BBF',
  RECOVERY: '#d4880f',
  PASSWORD_EXPIRED: '#d4880f',
};

const StatusPieChart: React.FC<StatusPieChartProps> = ({ statusBreakdown }) => {
  // Filter out statuses with 0 count
  const data = Object.entries(statusBreakdown)
    .filter(([_, count]) => count > 0)
    .map(([status, count]) => ({
      name: getUserFriendlyStatus(status as UserStatus),
      value: count,
      status: status as UserStatus,
    }));

  if (data.length === 0) {
    return (
      <div className="empty-state" style={{ padding: '40px 20px' }}>
        <p>No user data available</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={250}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
          outerRadius={80}
          fill="#8884d8"
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.status]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: number, name: string) => [`${value} users`, name]}
          contentStyle={{
            backgroundColor: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            fontSize: '12px',
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: '11px' }}
          iconSize={10}
          iconType="circle"
        />
      </PieChart>
    </ResponsiveContainer>
  );
};

export default StatusPieChart;
