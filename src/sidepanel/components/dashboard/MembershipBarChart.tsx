import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface MembershipBarChartProps {
  membershipSources: { direct: number; ruleBased: number };
}

const MembershipBarChart: React.FC<MembershipBarChartProps> = ({ membershipSources }) => {
  // Validate input data
  const direct = typeof membershipSources.direct === 'number' && !isNaN(membershipSources.direct) ? membershipSources.direct : 0;
  const ruleBased = typeof membershipSources.ruleBased === 'number' && !isNaN(membershipSources.ruleBased) ? membershipSources.ruleBased : 0;
  const total = direct + ruleBased;

  // Log for debugging
  console.log('[MembershipBarChart] Rendering with data:', {
    input: membershipSources,
    validated: { direct, ruleBased, total },
  });

  // Prepare chart data with proper percentage calculation
  const data = [
    {
      name: 'Manual',
      count: direct,
      percentage: total > 0 ? ((direct / total) * 100).toFixed(1) : '0.0',
    },
    {
      name: 'Rule-Based',
      count: ruleBased,
      percentage: total > 0 ? ((ruleBased / total) * 100).toFixed(1) : '0.0',
    },
  ];

  const colors = ['#007BBF', '#4a934e'];

  // Handle edge case: no data
  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-gray-500 text-sm">
        No membership data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
        <XAxis type="number" style={{ fontSize: '11px' }} />
        <YAxis dataKey="name" type="category" style={{ fontSize: '12px' }} />
        <Tooltip
          formatter={(value: number, name: string, props: any) => [
            `${value} members (${props.payload.percentage}%)`,
            name,
          ]}
          contentStyle={{
            backgroundColor: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            fontSize: '12px',
          }}
        />
        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
          {data.map((_entry, index) => (
            <Cell key={`cell-${index}`} fill={colors[index]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

export default MembershipBarChart;
