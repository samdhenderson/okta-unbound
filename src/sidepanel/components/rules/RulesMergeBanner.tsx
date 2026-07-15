/**
 * @module sidepanel/components/rules/RulesMergeBanner
 * @description Surfaces sets of rules with identical conditions that can be merged.
 *
 * Rules that share a match expression but target different groups are redundant —
 * they can be consolidated into one rule carrying the union of their target
 * groups with no change to who is matched. This banner offers that merge (A4).
 */
import React from 'react';
import Button from '../shared/Button';
import type { MergeableRuleGroup } from '../../../shared/rules/consolidation';

interface RulesMergeBannerProps {
  /** Clusters of identical-expression rules (2+ each). */
  clusters: MergeableRuleGroup[];
  /** Start merging a cluster. */
  onMerge: (cluster: MergeableRuleGroup) => void;
}

/** Renders a banner listing mergeable rule sets, or nothing when there are none. */
const RulesMergeBanner: React.FC<RulesMergeBannerProps> = ({ clusters, onMerge }) => {
  if (clusters.length === 0) return null;

  return (
    <div className="rounded-md border border-primary-highlight bg-primary-light p-4 space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-primary-text">
          {clusters.length} set{clusters.length === 1 ? '' : 's'} of duplicate-condition rules
        </h3>
        <p className="text-xs text-neutral-600">
          These rules share an identical condition — merge each set into one rule with the union of
          its target groups.
        </p>
      </div>
      <ul className="space-y-2">
        {clusters.map((cluster) => (
          <li
            key={cluster.expression}
            className="flex items-center justify-between gap-3 rounded-md border border-neutral-200 bg-white px-3 py-2"
          >
            <span className="text-sm text-neutral-900 truncate">
              {cluster.rules.length} rules → {cluster.unionGroupIds.length} target group
              {cluster.unionGroupIds.length === 1 ? '' : 's'}
            </span>
            <Button variant="secondary" size="sm" icon="link" onClick={() => onMerge(cluster)}>
              Merge
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default RulesMergeBanner;
