/**
 * @module sidepanel/components/members/MemberFilterDrawer
 * @description Everything the member explorer can filter by, behind one disclosure.
 *
 * The Members tab used to stack seven surfaces above its first member row: a
 * load ladder, the membership-source strip, that strip's notes, search plus a
 * Filters toggle, the filter panel that toggle opened, the composition reports,
 * and the list header. A reader who opened the tab to see members saw controls.
 *
 * This is the drawer half of the replacement. One control line stays visible
 * ({@link MemberExplorer}); every remaining control lives here and is reached by
 * one keystroke on a single, properly-named trigger.
 *
 * ## What it holds, in the order a reader asks for it
 *
 * 1. **Source** — where these members came from, as a meter that is also a
 *    filter, with this group's own commentary under it.
 * 2. **Status, MFA factors, sort** — {@link MemberFilterPanel}, unchanged but for
 *    its chips, which moved up to the visible line.
 * 3. **Profile attributes** — {@link AttributeFilterList}: one row per discovered
 *    attribute, each a route into the shared value reveal.
 * 4. **A pointer to Insights**, where the composition reports now live.
 *
 * ## The disclosure
 *
 * `.disclose` is the shared height animation (`grid-template-rows` 0fr to 1fr,
 * no JS measurement), the same mechanism `CollapsibleSection` and every
 * expandable row use. Two properties matter here specifically:
 *
 * - **The contents stay mounted.** A reader who sets a factor mode, closes the
 *   drawer to look at the list, and reopens it finds the panel exactly as they
 *   left it — no state is lifted or re-derived to achieve that.
 * - **`inert` while closed**, so every control inside leaves the tab order *and*
 *   the accessible tree. A `hidden` class gets the first half only.
 *
 * Reduced motion needs nothing here: `tailwind.css` flattens the transition
 * globally for `prefers-reduced-motion` and for `[data-motion='off']`, so there
 * is no second motion path in this file to keep in sync.
 *
 * The trigger is `FilterToggle` with `controls` set to this region's `id`, which
 * makes it announce `aria-expanded`/`aria-controls` rather than `aria-pressed` —
 * a region that opens, not a setting that is on.
 */
import React from 'react';
import Button from '../shared/Button';
import MemberFilterPanel from './MemberFilterPanel';
import MemberSourceFilterBar from './MemberSourceFilterBar';
import AttributeFilterList from './AttributeFilterList';
import type { MemberFiltersApi } from '../../hooks/useMemberFilters';
import type { MemberMfaResult, MfaScanStatus } from '../../../shared/types';
import type { AttributeSummary, BreakdownRow, SortField } from './memberAnalytics';
import type { MemberSourceContext } from './memberSourceContext';

/** Props for {@link MemberFilterDrawer}. */
export interface MemberFilterDrawerProps {
  /** `id` of the disclosed region — the trigger's `aria-controls` target. */
  id: string;
  /** Whether the drawer is open. */
  open: boolean;
  /** The explorer's filter set and its mutators. */
  memberFilters: MemberFiltersApi;
  /** Per-member membership source. Absent ⇒ no source section at all. */
  memberSource?: MemberSourceContext;
  /** This group's commentary about its own split, under the source strip. */
  sourceDetail?: React.ReactNode;
  /** Status distribution used to build the status pills. */
  statusRows: BreakdownRow[];
  /** Per-member MFA scan results, or `null` before a scan has run. */
  mfaResults: Map<string, MemberMfaResult> | null;
  /** Observed factor labels across the group. */
  factorLabels: string[];
  /** Member count; drives the scan button's disabled/confirm behaviour. */
  memberCount: number;
  /** Current MFA scan lifecycle status. */
  scanStatus: MfaScanStatus;
  /** Start (or confirm) the MFA scan. */
  onRunScanClick: () => void;
  /** Current sort field. */
  sortBy: SortField;
  /** Whether the current sort is descending. */
  sortDesc: boolean;
  /** Toggle the sort field, or flip its direction. */
  onToggleSort: (field: SortField) => void;
  /** Discovered profile attributes, in discovery order. */
  attributes: AttributeSummary[];
  /** Dimensions with at least one active filter, for the attribute rows' state. */
  filteredDimensions: ReadonlySet<string>;
  /** Open the value reveal for one attribute key. */
  onSelectAttribute: (attributeKey: string) => void;
  /** Moves to the group's Insights tab. Absent ⇒ no pointer is drawn. */
  onOpenInsights?: () => void;
}

/**
 * The member explorer's filter controls, as one disclosed region.
 *
 * @param props - See {@link MemberFilterDrawerProps}.
 */
const MemberFilterDrawer: React.FC<MemberFilterDrawerProps> = ({
  id,
  open,
  memberFilters,
  memberSource,
  sourceDetail,
  statusRows,
  mfaResults,
  factorLabels,
  memberCount,
  scanStatus,
  onRunScanClick,
  sortBy,
  sortDesc,
  onToggleSort,
  attributes,
  filteredDimensions,
  onSelectAttribute,
  onOpenInsights,
}) => (
  <div id={id} className="disclose" data-open={open} inert={!open || undefined}>
    {/* The `.disclose` contract: one direct child, which the CSS clips; the
        padding lives one level further in so it is clipped with the content
        rather than holding the collapsed row open. */}
    <div>
      <div className="space-y-(--sp-rung) rounded-md border border-neutral-200 bg-white p-(--sp-card)">
        {/* Where these members came from: proportion at a glance, a filter per
            slice, and this group's own commentary under it. */}
        {memberSource && (
          <div className="space-y-3">
            <h4 className="text-xs font-medium text-neutral-600">Source</h4>
            <MemberSourceFilterBar
              segments={memberSource.segments}
              activeKeys={memberFilters.sourceKeys}
              onToggle={memberFilters.toggleSource}
              onClearAll={memberFilters.clearSource}
              total={memberSource.index.byUserId.size}
            />
            {sourceDetail}
          </div>
        )}

        <MemberFilterPanel
          filters={memberFilters.filters}
          statusRows={statusRows}
          mfaResults={mfaResults}
          factorLabels={factorLabels}
          memberCount={memberCount}
          scanStatus={scanStatus}
          onRunScanClick={onRunScanClick}
          sortBy={sortBy}
          sortDesc={sortDesc}
          onToggleStatus={memberFilters.toggleStatus}
          onClearStatus={memberFilters.clearStatus}
          onToggleMfaValue={memberFilters.toggleMfaValue}
          onSetFactorMode={memberFilters.setFactorMode}
          onToggleSort={onToggleSort}
        />

        {/* An attribute is a route to a value, not a report: picking one opens
            the same reveal the Insights tab uses, over that attribute's full
            distribution, and picking a value there filters the list. There is
            deliberately no second picker — see `AttributeFilterList`. */}
        <div className="space-y-1.5">
          <h4 className="text-xs font-medium text-neutral-600">Profile attributes</h4>
          <AttributeFilterList
            attributes={attributes}
            filteredKeys={filteredDimensions}
            onSelect={onSelectAttribute}
          />
        </div>

        {/* The composition reports moved to Insights: they are analysis, not a
            member control. A pointer stays because the reader who wanted them
            looked for them on this tab. Omitted rather than drawn dead when the
            caller cannot honour it (ADR-0039). */}
        {onOpenInsights && (
          <div className="space-y-1.5">
            <p className="text-xs text-neutral-500">
              Attribute and MFA-factor distributions for this group are on the Insights tab.
            </p>
            <Button variant="secondary" size="sm" onClick={onOpenInsights}>
              Open Insights
            </Button>
          </div>
        )}
      </div>
    </div>
  </div>
);

export default MemberFilterDrawer;
