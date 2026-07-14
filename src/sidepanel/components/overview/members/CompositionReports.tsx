import React, { useMemo, useState } from 'react';
import CollapsibleSection from '../../shared/CollapsibleSection';
import AttributeFacet from './AttributeFacet';
import {
  type AttributeSummary,
  type BreakdownRow,
  type Dimension,
  type MemberFilter,
} from './memberAnalytics';

interface CompositionReportsProps {
  /** Discovered profile attributes with their value distributions. */
  attributes: AttributeSummary[];
  filters: MemberFilter[];
  onToggle: (dimension: Dimension, row: BreakdownRow) => void;
  /** Open the full-distribution details view for an attribute. */
  onExpand: (key: string) => void;
}

/** Above this many attributes, offer a quick filter to jump to one. */
const SEARCH_THRESHOLD = 6;

const CompositionReports: React.FC<CompositionReportsProps> = ({
  attributes,
  filters,
  onToggle,
  onExpand,
}) => {
  const [attrQuery, setAttrQuery] = useState('');

  const activeByDimension = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const f of filters) {
      let set = map.get(f.dimension);
      if (!set) {
        set = new Set();
        map.set(f.dimension, set);
      }
      set.add(f.value);
    }
    return map;
  }, [filters]);

  const q = attrQuery.trim().toLowerCase();
  const visible = q
    ? attributes.filter((a) => a.label.toLowerCase().includes(q) || a.key.toLowerCase().includes(q))
    : attributes;

  if (attributes.length === 0) {
    return (
      <p className="text-xs text-neutral-500">
        No profile attributes (department, title, location…) are populated for this group.
      </p>
    );
  }

  return (
    <CollapsibleSection
      title="Attribute composition"
      itemCount={attributes.length}
      defaultOpen={false}
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-neutral-500">Click any value to filter the members.</p>
          {attributes.length > SEARCH_THRESHOLD && (
            <div className="relative">
              <svg
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z"
                />
              </svg>
              <input
                type="text"
                value={attrQuery}
                onChange={(e) => setAttrQuery(e.target.value)}
                placeholder="Find attribute…"
                className="w-40 rounded-md border border-neutral-200 bg-white py-1 pl-8 pr-2 text-xs text-neutral-800 placeholder:text-neutral-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          )}
        </div>

        {visible.length === 0 ? (
          <p className="text-xs text-neutral-500">No attribute matches “{attrQuery}”.</p>
        ) : (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((attr) => (
              <AttributeFacet
                key={attr.key}
                summary={attr}
                activeValues={activeByDimension.get(attr.key) ?? new Set()}
                onToggleValue={(row) => onToggle(attr.key, row)}
                onExpand={() => onExpand(attr.key)}
              />
            ))}
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
};

export default CompositionReports;
