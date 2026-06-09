import React from 'react';
import CollapsibleSection from '../../shared/CollapsibleSection';
import BreakdownReport from './BreakdownReport';
import {
  type BreakdownRow,
  type Dimension,
  type MemberFilter,
  type ProfileDimension,
  COMPOSITION_DIMENSIONS,
  DIMENSION_TITLES,
  NONE_VALUE,
} from './memberAnalytics';

interface CompositionReportsProps {
  breakdowns: Record<ProfileDimension, BreakdownRow[]>;
  filters: MemberFilter[];
  onToggle: (dimension: Dimension, row: BreakdownRow) => void;
  /** Open the full-distribution details modal for a dimension (the "Other" values). */
  onShowOther: (dimension: ProfileDimension) => void;
}

const CompositionReports: React.FC<CompositionReportsProps> = ({
  breakdowns,
  filters,
  onToggle,
  onShowOther,
}) => {
  // Only render dimensions where at least one member has a real (non-empty) value.
  const visibleDimensions = COMPOSITION_DIMENSIONS.filter((dim) =>
    breakdowns[dim].some((row) => row.value !== NONE_VALUE && row.count > 0)
  );

  if (visibleDimensions.length === 0) {
    return (
      <p className="text-xs text-neutral-500">
        No profile attributes (department, title, location…) are populated for this group.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {visibleDimensions.map((dim, index) => {
        const activeValues = new Set(
          filters.filter((f) => f.dimension === dim).map((f) => f.value)
        );
        const distinct = breakdowns[dim].length;
        return (
          <CollapsibleSection
            key={dim}
            title={DIMENSION_TITLES[dim]}
            defaultOpen={index === 0}
            itemCount={distinct}
          >
            <BreakdownReport
              rows={breakdowns[dim]}
              activeValues={activeValues}
              onRowClick={(row) => onToggle(dim, row)}
              onShowOther={() => onShowOther(dim)}
            />
          </CollapsibleSection>
        );
      })}
    </div>
  );
};

export default CompositionReports;
