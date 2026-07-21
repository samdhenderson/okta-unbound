/**
 * @module sidepanel/components/overview/members/CompositionReports
 * @description Collapsible "Composition" panel: attribute distribution + MFA factor breakdown.
 *
 * One section with a segmented toggle between **Attributes** (one
 * {@link AttributeFacet} per discovered profile attribute) and **MFA factors**
 * (the scan's factor distribution). Both describe "what this group is made of",
 * so they share a home. Value clicks bubble up as member-list facet toggles;
 * "View all" requests the full-distribution modal for an attribute.
 */
import React, { useMemo, useState } from 'react';
import type { MemberMfaResult, MfaScanStatus } from '../../../../shared/types';
import CollapsibleSection from '../../shared/CollapsibleSection';
import { Input, Tabs, type TabItem } from '../../shared';
import Icon from '../shared/Icon';
import AttributeFacet from './AttributeFacet';
import BreakdownReport from './BreakdownReport';
import MfaScanButton from './MfaScanButton';
import {
  type AttributeSummary,
  type BreakdownRow,
  type Dimension,
  type MemberFilter,
} from './memberAnalytics';

/** Props for {@link CompositionReports}. */
interface CompositionReportsProps {
  /** Discovered profile attributes with their value distributions. */
  attributes: AttributeSummary[];
  /** Active member-list filters, used to highlight selected values. */
  filters: MemberFilter[];
  /** Toggle a value within an attribute as a member-list filter. */
  onToggle: (dimension: Dimension, row: BreakdownRow) => void;
  /** Open the full-distribution details view for an attribute. */
  onExpand: (key: string) => void;
  /** Pre-computed MFA factor distribution rows (empty before a scan). */
  mfaRows: BreakdownRow[];
  /** Per-member MFA scan results, or null before a scan has run. */
  mfaResults: Map<string, MemberMfaResult> | null;
  /** Current MFA scan lifecycle status. */
  scanStatus: MfaScanStatus;
  /** Member count; drives the scan button's disabled/confirm behaviour. */
  memberCount: number;
  /** Toggle an MFA breakdown row as a member-list filter. */
  onToggleMfa: (row: BreakdownRow) => void;
  /** Start (or confirm) the MFA scan from the MFA tab's empty state. */
  onRunScanClick: () => void;
}

/** Above this many attributes, offer a quick filter to jump to one. */
const SEARCH_THRESHOLD = 6;

/** Renders the Attributes-vs-MFA composition section as one collapsible panel. */
const CompositionReports: React.FC<CompositionReportsProps> = ({
  attributes,
  filters,
  onToggle,
  onExpand,
  mfaRows,
  mfaResults,
  scanStatus,
  memberCount,
  onToggleMfa,
  onRunScanClick,
}) => {
  const [tab, setTab] = useState<'attributes' | 'mfa'>('attributes');
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

  const mfaActive = activeByDimension.get('mfa') ?? new Set<string>();

  const q = attrQuery.trim().toLowerCase();
  const visible = q
    ? attributes.filter((a) => a.label.toLowerCase().includes(q) || a.key.toLowerCase().includes(q))
    : attributes;

  const tabs: TabItem[] = [
    { key: 'attributes', label: 'Attributes', count: attributes.length },
    { key: 'mfa', label: 'MFA factors' },
  ];

  return (
    <CollapsibleSection title="Composition" defaultOpen={false}>
      <div className="space-y-3">
        <Tabs
          variant="segmented"
          tabs={tabs}
          activeKey={tab}
          onChange={(key) => setTab(key as 'attributes' | 'mfa')}
          ariaLabel="Group composition report"
        />

        {tab === 'attributes' &&
          (attributes.length === 0 ? (
            <p className="text-xs text-neutral-500">
              No profile attributes (department, title, location…) are populated for this group.
            </p>
          ) : (
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
          ))}

        {tab === 'mfa' &&
          (!mfaResults ? (
            <div className="flex flex-col items-start gap-2 py-1">
              <p className="text-xs text-neutral-500">
                Scan the group to see the distribution of enrolled MFA factors.
              </p>
              <MfaScanButton
                mfaResults={mfaResults}
                scanStatus={scanStatus}
                memberCount={memberCount}
                onScanClick={onRunScanClick}
              />
              {scanStatus === 'error' && (
                <p className="text-xs text-danger-text">The MFA scan failed. Please try again.</p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-neutral-500">Click any factor to filter the members.</p>
              <BreakdownReport
                rows={mfaRows}
                activeValues={mfaActive}
                onRowClick={onToggleMfa}
                emptyMessage="No factor data"
              />
            </div>
          ))}
      </div>
    </CollapsibleSection>
  );
};

export default CompositionReports;
