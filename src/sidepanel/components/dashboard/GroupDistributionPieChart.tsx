/**
 * Interactive pie chart for displaying group distribution
 * Supports toggling between user status and membership source views
 */

import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from 'recharts';
import type { UserStatus, OktaUser } from '../../../shared/types';
import ViewModeToggle, { type ViewMode } from './ViewModeToggle';
import { renderActiveShape } from './PieChartActiveShape';
import { buildStatusData, buildRuleData, type ChartData } from './pieChartUtils';

// Custom component to render label on top of everything
const ActiveLabel: React.FC = () => {
  const [labelData, setLabelData] = useState<any>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const data = (window as any).__pieChartActiveLabel;
      if (data !== labelData) {
        setLabelData(data);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [labelData]);

  if (!labelData) return null;

  const { rectX, rectWidth, cx, cy, nameText, valueText } = labelData;

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1000,
      }}
    >
      <g>
        <rect
          x={rectX}
          y={cy - 30}
          width={rectWidth}
          height={50}
          rx={8}
          fill="rgba(255, 255, 255, 0.7)"
          stroke="#d1d5db"
          strokeWidth={1.5}
          filter="url(#labelShadow)"
        />
        <text
          x={cx}
          y={cy - 8}
          textAnchor="middle"
          fill="#111827"
          fontSize={14}
          fontWeight="600"
        >
          {nameText}
        </text>
        <text
          x={cx}
          y={cy + 12}
          textAnchor="middle"
          fill="#6b7280"
          fontSize={12}
        >
          {valueText}
        </text>
      </g>
    </svg>
  );
};

interface GroupDistributionPieChartProps {
  statusBreakdown: Record<UserStatus, number>;
  members: OktaUser[];
  onRuleClick?: (ruleId: string) => void;
}

const GroupDistributionPieChart: React.FC<GroupDistributionPieChartProps> = ({
  statusBreakdown,
  members,
  onRuleClick,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('status');

  const data = viewMode === 'status'
    ? buildStatusData(statusBreakdown)
    : buildRuleData(members);

  const handlePieClick = (data: ChartData) => {
    if (viewMode === 'rules' && data.id && data.id !== 'direct' && onRuleClick) {
      onRuleClick(data.id);
    }
  };

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-gray-500 text-sm">No data available</p>
      </div>
    );
  }

  return (
    <div>
      <ViewModeToggle viewMode={viewMode} onViewModeChange={setViewMode} />

      <div style={{ position: 'relative' }}>
        <ActiveLabel />
        <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <defs>
            <filter id="labelShadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.1"/>
            </filter>
          </defs>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            outerRadius={80}
            dataKey="value"
            activeShape={renderActiveShape}
            onClick={(entry) => handlePieClick(entry)}
            style={{ cursor: viewMode === 'rules' ? 'pointer' : 'default' }}
            isAnimationActive={false}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Legend
            wrapperStyle={{ fontSize: '11px' }}
            iconSize={10}
            iconType="circle"
          />
        </PieChart>
      </ResponsiveContainer>
      </div>

      {viewMode === 'rules' && onRuleClick && (
        <p className="text-xs text-gray-500 text-center mt-3">
          Click a rule segment to navigate to that rule
        </p>
      )}
    </div>
  );
};

export default GroupDistributionPieChart;
