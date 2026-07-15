/**
 * @module sidepanel/components/users/comparison/ComparisonOverviewTab
 * @description Summary tab with two proportion cards (groups + apps) and jump-to-detail links.
 */
import React from 'react';
import Icon from '../../overview/shared/Icon';
import type { OktaGroup } from '../../../../shared/types';
import type { AppEntry } from './comparisonAnalytics';

/** Props for {@link ComparisonOverviewTab}. */
interface ComparisonOverviewTabProps {
  /** Display name for the context user. */
  contextName: string;
  /** Display name for the compared user. */
  comparedName: string;
  /** Bucketed group memberships (only-compared / shared / only-context). */
  groupBuckets: { onlyCompared: OktaGroup[]; shared: OktaGroup[]; onlyContext: OktaGroup[] };
  /** Bucketed app assignments (only-compared / shared / only-context). */
  appBuckets: { onlyCompared: AppEntry[]; shared: AppEntry[]; onlyContext: AppEntry[] };
  /** Group overlap as a whole percent (0–100). */
  groupSimilarity: number;
  /** App overlap as a whole percent (0–100). */
  appSimilarity: number;
  /** Jumps to the Groups detail tab. */
  onJumpToGroups: () => void;
  /** Jumps to the Apps detail tab. */
  onJumpToApps: () => void;
}

/** Overview tab: two proportion cards (groups + apps) with jump-to-detail links. */
const ComparisonOverviewTab: React.FC<ComparisonOverviewTabProps> = ({
  contextName,
  comparedName,
  groupBuckets,
  appBuckets,
  groupSimilarity,
  appSimilarity,
  onJumpToGroups,
  onJumpToApps,
}) => (
  <div className="space-y-4">
    <OverviewCard
      icon="users"
      heading="Group memberships"
      similarity={groupSimilarity}
      contextName={contextName}
      comparedName={comparedName}
      onlyContext={groupBuckets.onlyContext.length}
      shared={groupBuckets.shared.length}
      onlyCompared={groupBuckets.onlyCompared.length}
      onJump={onJumpToGroups}
    />
    <OverviewCard
      icon="app"
      heading="App assignments"
      similarity={appSimilarity}
      contextName={contextName}
      comparedName={comparedName}
      onlyContext={appBuckets.onlyContext.length}
      shared={appBuckets.shared.length}
      onlyCompared={appBuckets.onlyCompared.length}
      onJump={onJumpToApps}
    />
  </div>
);

/** Props for the internal {@link OverviewCard}. */
interface OverviewCardProps {
  /** Icon glyph identifying the category. */
  icon: 'users' | 'app';
  /** Card heading (e.g. "Group memberships"). */
  heading: string;
  /** Overlap as a whole percent (0–100). */
  similarity: number;
  /** Display name for the context user. */
  contextName: string;
  /** Display name for the compared user. */
  comparedName: string;
  /** Count unique to the context user. */
  onlyContext: number;
  /** Count shared by both users. */
  shared: number;
  /** Count unique to the compared user. */
  onlyCompared: number;
  /** Navigates to this category's detail tab. */
  onJump: () => void;
}

/**
 * One category card: proportion bar, three count stats, and an overlap summary.
 * For groups, also hints how many groups can be copied over.
 */
const OverviewCard: React.FC<OverviewCardProps> = ({
  icon,
  heading,
  similarity,
  contextName,
  comparedName,
  onlyContext,
  shared,
  onlyCompared,
  onJump,
}) => {
  const total = onlyContext + shared + onlyCompared;

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-neutral-100 p-1.5 text-neutral-700">
            <Icon type={icon} size="sm" />
          </span>
          <h4 className="text-sm font-semibold text-neutral-900">{heading}</h4>
        </div>
        <button
          onClick={onJump}
          className="flex items-center gap-1 text-xs font-semibold text-primary-text hover:text-primary-dark"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          View details
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <ProportionStack onlyContext={onlyContext} shared={shared} onlyCompared={onlyCompared} />

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Stat value={onlyContext} label={`Only ${contextName}`} dotClass="bg-neutral-400" />
        <Stat value={shared} label="Shared" dotClass="bg-success" emphasis />
        <Stat value={onlyCompared} label={`Only ${comparedName}`} dotClass="bg-primary" />
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-3 text-xs">
        <span className="text-neutral-500">
          {total} total · {similarity}% overlap
        </span>
        {onlyCompared > 0 && icon === 'users' && (
          <span className="flex items-center gap-1 font-semibold text-primary-text">
            <Icon type="plus" size="sm" />
            {onlyCompared} can be copied over
          </span>
        )}
      </div>
    </div>
  );
};

/** A single count stat (value + color-dot label), optionally emphasized for the shared bucket. */
const Stat: React.FC<{
  value: number;
  label: string;
  dotClass: string;
  emphasis?: boolean;
}> = ({ value, label, dotClass, emphasis }) => (
  <div className="rounded-md bg-neutral-50/70 px-2 py-2">
    <div
      className={`font-mono text-xl font-bold leading-none ${
        emphasis ? 'text-success-text' : 'text-neutral-900'
      }`}
    >
      {value}
    </div>
    <div className="mt-1.5 flex items-center justify-center gap-1.5 text-[10px] font-medium text-neutral-600">
      <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
      <span className="truncate" title={label}>
        {label}
      </span>
    </div>
  </div>
);

/** Horizontal stacked bar showing the relative sizes of the three buckets. */
const ProportionStack: React.FC<{
  onlyContext: number;
  shared: number;
  onlyCompared: number;
}> = ({ onlyContext, shared, onlyCompared }) => {
  const total = onlyContext + shared + onlyCompared;
  if (total === 0) {
    return <div className="mt-3 h-2 w-full rounded-full bg-neutral-100" aria-hidden />;
  }
  const pct = (n: number) => (n / total) * 100;
  return (
    <div className="mt-3 flex h-2 w-full overflow-hidden rounded-full bg-neutral-100" aria-hidden>
      {onlyContext > 0 && (
        <div className="h-full bg-neutral-400" style={{ width: `${pct(onlyContext)}%` }} />
      )}
      {shared > 0 && <div className="h-full bg-success" style={{ width: `${pct(shared)}%` }} />}
      {onlyCompared > 0 && (
        <div className="h-full bg-primary" style={{ width: `${pct(onlyCompared)}%` }} />
      )}
    </div>
  );
};

export default ComparisonOverviewTab;
