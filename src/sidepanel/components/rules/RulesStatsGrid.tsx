/**
 * @module sidepanel/components/rules/RulesStatsGrid
 * @description The Rules tab's four summary tiles (total / active / inactive / conflicts).
 *
 * Uses the shared {@link StatCard} so the Rules overview reads consistently with
 * the Overview tab's stat grids.
 */
import React from 'react';
import StatCard from '../overview/shared/StatCard';
import type { RuleStats } from '../../../shared/types';

interface RulesStatsGridProps {
  /** Aggregate rule counts. */
  stats: RuleStats;
}

/** Renders the total/active/inactive/conflicts stat tiles for the Rules tab. */
const RulesStatsGrid: React.FC<RulesStatsGridProps> = ({ stats }) => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
    <StatCard title="Total Rules" value={stats.total} color="neutral" icon="list" />
    <StatCard title="Active" value={stats.active} color="success" icon="check" />
    <StatCard title="Inactive" value={stats.inactive} color="neutral" icon="pause" />
    <StatCard
      title="Conflicts"
      value={stats.conflicts}
      color={stats.conflicts > 0 ? 'warning' : 'neutral'}
      icon="alert"
    />
  </div>
);

export default RulesStatsGrid;
