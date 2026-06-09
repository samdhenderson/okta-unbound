import React from 'react';
import CollapsibleSection from '../../shared/CollapsibleSection';
import BreakdownReport from './BreakdownReport';
import {
  type BreakdownRow,
  type Dimension,
  type MemberFilter,
  type ProfileDimension,
  PROFILE_DIMENSIONS,
  DIMENSION_TITLES,
  NONE_VALUE,
} from './memberAnalytics';

interface CompositionReportsProps {
  breakdowns: Record<ProfileDimension, BreakdownRow[]>;
  filters: MemberFilter[];
  onToggle: (dimension: Dimension, row: BreakdownRow) => void;
}

const CompositionReports: React.FC<CompositionReportsProps> = ({ breakdowns, filters, onToggle }) => {
  // Only render dimensions where at least one member has a real (non-empty) value.
  const visibleDimensions = PROFILE_DIMENSIONS.filter((dim) =>
    breakdowns[dim].some((row) => row.value !== NONE_VALUE && row.count > 0)
  );

  if (visibleDimensions.length === 0) return null;

  return (
    <div className="space-y-3">
      {visibleDimensions.map((dim) => {
        const activeValues = new Set(
          filters.filter((f) => f.dimension === dim).map((f) => f.value)
        );
        const distinct = breakdowns[dim].length;
        return (
          <CollapsibleSection
            key={dim}
            title={DIMENSION_TITLES[dim]}
            defaultOpen={dim === 'status'}
            itemCount={distinct}
          >
            <BreakdownReport
              rows={breakdowns[dim]}
              activeValues={activeValues}
              onRowClick={(row) => onToggle(dim, row)}
            />
          </CollapsibleSection>
        );
      })}
    </div>
  );
};

export default CompositionReports;
