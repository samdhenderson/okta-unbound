import React, { useMemo, useState } from 'react';
import CollapsibleSection from '../../shared/CollapsibleSection';
import { Input } from '../../shared';
import Icon from '../shared/Icon';
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
            <Input
              value={attrQuery}
              onChange={setAttrQuery}
              placeholder="Find attribute…"
              icon={<Icon type="search" size="sm" />}
              fullWidth={false}
              className="w-44"
            />
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
