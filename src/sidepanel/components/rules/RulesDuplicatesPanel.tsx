/**
 * @module sidepanel/components/rules/RulesDuplicatesPanel
 * @description The Rules rung's duplicate-condition panel: rule sets that can be safely
 * merged, opened from the strip's *Duplicates (N)* verb.
 *
 * Rules that share a match expression but target different groups are redundant —
 * they can be consolidated into one rule carrying the union of their target
 * groups with no change to who is matched. This panel offers that merge (A4).
 *
 * Each set expands to reveal the shared condition and its member rules — each with a
 * "View" link that scrolls to the rule's card so the expression can be reviewed
 * before merging. Merging opens a preview wizard; nothing is written until the
 * admin confirms there.
 *
 * ## It used to hide behind two disclosures, and that was one too many
 *
 * This was `RulesMergeBanner`: a `bg-primary-light` band that sat permanently above the
 * rules list, **started collapsed**, and put its sets behind a *Review* pill — which then
 * put each set's contents behind a second chevron. Two presses before the reader saw a
 * single duplicate, on a card most of them scrolled straight past. It is the most
 * valuable read-only analysis the tab performs and it was the least reachable thing on it.
 *
 * The outer disclosure is gone. The strip's `Duplicates (N)` verb is now the one that
 * holds this closed, which also means the count is stated where the reader decides
 * whether to open it rather than inside the thing they have to open first. The per-set
 * chevrons stay: with several sets, expanding all of them at once is a wall.
 */
import React, { useState } from 'react';
import Button from '../shared/Button';
import type { MergeableRuleGroup } from '../../../shared/rules/consolidation';

interface RulesDuplicatesPanelProps {
  /** Clusters of identical-expression rules (2+ each). */
  clusters: MergeableRuleGroup[];
  /** Start merging a cluster (opens the non-destructive preview wizard). */
  onMerge: (cluster: MergeableRuleGroup) => void;
  /** Scroll to and highlight a rule by id (its "View" link). */
  onFocusRule?: (ruleId: string) => void;
}

/** A small ACTIVE/INACTIVE status pill matching the app's status vocabulary. */
const StatusPill: React.FC<{ status: string }> = ({ status }) => {
  const active = status === 'ACTIVE';
  return (
    <span
      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border ${
        active
          ? 'bg-success-light text-success-text border-success-light'
          : 'bg-neutral-100 text-neutral-500 border-neutral-200'
      }`}
    >
      {active ? 'Active' : 'Inactive'}
    </span>
  );
};

/** One expandable set of duplicate-condition rules. */
const MergeClusterRow: React.FC<{
  cluster: MergeableRuleGroup;
  onMerge: (cluster: MergeableRuleGroup) => void;
  onFocusRule?: (ruleId: string) => void;
}> = ({ cluster, onMerge, onFocusRule }) => {
  const [open, setOpen] = useState(false);

  return (
    <li className="rounded-md border border-neutral-200 bg-white">
      <div className="flex items-center justify-between gap-3 px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="press-subtle flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <svg
            className={`h-3.5 w-3.5 shrink-0 text-neutral-400 transition-transform duration-(--dur-instant) ${
              open ? 'rotate-90' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="truncate text-sm text-neutral-900">
            {cluster.rules.length} rules → {cluster.unionGroupIds.length} target group
            {cluster.unionGroupIds.length === 1 ? '' : 's'}
          </span>
        </button>
        <Button variant="secondary" size="sm" icon="link" onClick={() => onMerge(cluster)}>
          Review &amp; merge
        </Button>
      </div>

      {open && (
        <div className="space-y-2 border-t border-neutral-100 px-3 py-2.5">
          <div>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
              Shared condition
            </div>
            <code className="block break-words rounded bg-neutral-50 px-2 py-1 font-mono text-xs text-neutral-700">
              {cluster.expression}
            </code>
          </div>
          <ul className="space-y-1">
            {cluster.rules.map((rule) => {
              const targetCount = rule.actions?.assignUserToGroups?.groupIds?.length ?? 0;
              return (
                <li
                  key={rule.id}
                  className="flex items-center justify-between gap-2 rounded border border-neutral-100 px-2 py-1.5"
                >
                  <div className="flex min-w-0 items-center gap-(--sp-inline)">
                    <StatusPill status={rule.status} />
                    <span className="truncate text-sm text-neutral-800">{rule.name}</span>
                    <span className="shrink-0 text-xs text-neutral-400">
                      {targetCount} group{targetCount === 1 ? '' : 's'}
                    </span>
                  </div>
                  {onFocusRule && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onFocusRule(rule.id)}
                      title="Scroll to this rule's card"
                    >
                      View
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="text-[11px] text-neutral-400">
            Merge creates one rule with the union of these target groups and retires the originals —
            no change to who is matched. You&apos;ll see a full preview before anything is written.
          </p>
        </div>
      )}
    </li>
  );
};

/**
 * Renders the duplicate-condition sets, or nothing when there are none.
 *
 * The `clusters.length === 0` guard is kept even though the strip omits the verb that
 * opens this panel in that case: the component is also rendered directly by its stories
 * and by the Storybook docs, and a panel that decides for itself what to do with an empty
 * list cannot be opened onto a blank card by a caller that forgets the check.
 */
const RulesDuplicatesPanel: React.FC<RulesDuplicatesPanelProps> = ({
  clusters,
  onMerge,
  onFocusRule,
}) => {
  if (clusters.length === 0) return null;

  return (
    <section
      aria-labelledby="rules-duplicates-heading"
      className="animate-rise-in rounded-md border border-primary-highlight bg-primary-light p-(--sp-card)"
    >
      <h3 id="rules-duplicates-heading" className="text-sm font-semibold text-primary-text">
        {clusters.length} set{clusters.length === 1 ? '' : 's'} of duplicate-condition rules
      </h3>
      <p className="mt-0.5 text-xs text-neutral-600">
        Each set below shares an identical condition. Merging one folds its rules into a single rule
        carrying the union of their target groups — no change to who is matched.
      </p>
      <ul className="mt-(--sp-card) space-y-(--sp-rung)">
        {clusters.map((cluster) => (
          <MergeClusterRow
            key={cluster.expression}
            cluster={cluster}
            onMerge={onMerge}
            onFocusRule={onFocusRule}
          />
        ))}
      </ul>
    </section>
  );
};

export default RulesDuplicatesPanel;
