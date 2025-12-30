/**
 * Active shape renderer for highlighting selected pie chart segment
 */

import { Sector } from 'recharts';

export const renderActiveShape = (props: any) => {
  const {
    cx, cy, innerRadius, outerRadius, startAngle, endAngle,
    fill, payload, percent, value
  } = props;

  // Calculate text lengths for dynamic backdrop sizing
  const nameText = payload.name || '';
  const valueText = `${value} users (${(percent * 100).toFixed(0)}%)`;

  // More accurate text width estimation
  // Font size 14px bold for name, 12px regular for value
  const nameWidth = nameText.length * 9; // Bold text is wider
  const valueWidth = valueText.length * 7.5;
  const maxTextWidth = Math.max(nameWidth, valueWidth);
  const rectWidth = Math.max(maxTextWidth + 30, 150); // Padding + minimum width
  const rectX = cx - rectWidth / 2;

  // Store label data in a global position for rendering after all sectors
  // This ensures the label is always on top
  const labelData = {
    rectX,
    rectWidth,
    cx,
    cy,
    nameText,
    valueText,
  };

  // Attach to window temporarily to render after all sectors
  if (typeof window !== 'undefined') {
    (window as any).__pieChartActiveLabel = labelData;
  }

  return (
    <g>
      {/* Render the sector with expansion */}
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 8}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        stroke="#fff"
        strokeWidth={2}
      />
      {/* Label will be rendered separately by the custom label renderer */}
    </g>
  );
};
