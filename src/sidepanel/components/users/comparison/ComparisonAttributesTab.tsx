/**
 * @module sidepanel/components/users/comparison/ComparisonAttributesTab
 * @description The comparison's fourth dimension: what is *different about these
 * two people*, attribute by attribute, in the admin's own categories and order.
 *
 * Groups and apps answer "who has what access". Neither answers the question an
 * admin actually arrives with when two people have different access, and the
 * attributes are the evidence group rules read — so an attribute diff is very
 * often the whole explanation.
 *
 * ## It borrows `ComparisonDiffTab`'s chrome, and departs from it in three places
 *
 * The chrome is deliberately the same: filter pills, a search field, and one
 * bordered container whose rows are separated by `divide-y divide-neutral-100`
 * (ADR-0029's second sanctioned separator pattern, for a dense table-like
 * surface — the rows are `<li>` and carry no card border of their own, so this is
 * not a `ListRow` surface). {@link ComparisonAttributeRow} holds the row itself,
 * including the three-track parity strip and the equality marker.
 *
 * What differs from the groups/apps list, and why:
 *
 * 1. **The cells carry values, not checkmarks.** Set membership is a yes/no;
 *    `department` is a string, and "both users have a department" is not the fact
 *    an admin needs.
 * 2. **Rows group under category eyebrows**, in the admin's configured order with
 *    Uncategorized last, exactly as the Profile pane groups them. Two different
 *    groupings from one config would be a bug an admin could never explain.
 *
 * ## Hidden differences are disclosed, never dropped
 *
 * The display config can hide an attribute, and the one it hides may be the one
 * explaining an access gap. A comparison that silently omitted it would be worse
 * than no comparison, so {@link ComparisonAttributesTabProps.hiddenDifferences}
 * is stated above the list with a control that reveals the hidden rows inline,
 * each marked as hidden. The admin's configuration is still honoured by default;
 * it is just never allowed to be invisible.
 *
 * ## Not editable from here
 *
 * There is no per-row action, and deliberately no equivalent of the Groups tab's
 * `renderContextAction`. Writing a profile attribute needs prior-state capture
 * and audit logging, which is a separate change.
 *
 * ## Security
 *
 * Attribute names, labels and values are end-user-controllable tenant data and
 * frequently PII, as are the rule names in a chip's tooltip. They are rendered
 * through React's escaping only — `dangerouslySetInnerHTML` and hand-built HTML
 * are banned — and **nothing in this module logs**.
 */
import React, { useMemo, useState } from 'react';
import { Button, EmptyState, Eyebrow, FilterPill, Input } from '../../shared';
import ComparisonAttributeRow from './ComparisonAttributeRow';
import { UNCATEGORIZED, UNCATEGORIZED_LABEL } from '../profileAttributeBlocks';
import type { AttributeParityRow, AttributeVerdict } from './attributeParity';
import type { ProfileDisplayConfig } from '../../../../shared/storage/profileDisplayStore';

/** Which rows the list is showing. Mirrors `ComparisonDiffTab`'s `ParityFilter`. */
export type AttributeFilter = 'differences' | 'shared' | 'all';

/** Props for {@link ComparisonAttributesTab}. */
export interface ComparisonAttributesTabProps {
  /** Display name of the context user (baseline) — the LEFT cell of every row. */
  contextName: string;
  /** Display name of the compared user — the RIGHT cell of every row. */
  comparedName: string;
  /**
   * The config-visible rows from `attributeParityRows`, already ordered
   * differences-first, then the config's order, then A–Z. **Never re-sorted
   * here** — the ordering is the pure module's decision, and one of the two
   * counts would otherwise disagree with the list.
   */
  rows: readonly AttributeParityRow[];
  /** Rows the config hides, kept whole so this surface can reveal them on demand. */
  hiddenRows: readonly AttributeParityRow[];
  /** How many of `hiddenRows` actually differ — the number behind the disclosure line. */
  hiddenDifferences: number;
  /**
   * The admin's reconciled display configuration. Read for the category list and
   * its order, `showApiNames` and `showRuleChips` — this component decides
   * nothing about placement itself.
   */
  config: ProfileDisplayConfig;
  /**
   * Attribute Okta name to the names of the rules that read it and currently
   * grant either user access, from `profileRuleReads`. Attributes absent from the
   * map carry no chip.
   */
  ruleReads: Record<string, string[]>;
}

/** One rendered category: its label and the rows that landed in it, in list order. */
interface AttributeBlock {
  key: string;
  name: string;
  rows: AttributeParityRow[];
}

/** Whether a verdict is something an admin might act on. Matches `attributeParity`'s own rule. */
const isDifference = (verdict: AttributeVerdict): boolean =>
  verdict === 'differs' || verdict === 'onlyContext' || verdict === 'onlyCompared';

/**
 * Group rows into the admin's categories, in the admin's order, Uncategorized
 * last. Empty blocks are dropped — a category the admin defined but filed nothing
 * into is not a finding, and an empty heading would read as one.
 */
function buildBlocks(
  rows: readonly AttributeParityRow[],
  categories: ProfileDisplayConfig['categories'],
): AttributeBlock[] {
  const byKey = new Map<string, AttributeParityRow[]>();
  for (const row of rows) {
    const bucket = byKey.get(row.categoryKey);
    if (bucket) bucket.push(row);
    else byKey.set(row.categoryKey, [row]);
  }

  const blocks: AttributeBlock[] = [];
  for (const category of categories) {
    const held = byKey.get(category.key);
    if (held && held.length > 0) blocks.push({ ...category, rows: held });
  }
  const uncategorized = byKey.get(UNCATEGORIZED);
  if (uncategorized && uncategorized.length > 0) {
    blocks.push({ key: UNCATEGORIZED, name: UNCATEGORIZED_LABEL, rows: uncategorized });
  }
  return blocks;
}

/** The attribute diff: two values per row, an equality marker, and the config's grouping. */
const ComparisonAttributesTab: React.FC<ComparisonAttributesTabProps> = ({
  contextName,
  comparedName,
  rows,
  hiddenRows,
  hiddenDifferences,
  config,
  ruleReads,
}) => {
  const [filter, setFilter] = useState<AttributeFilter>('differences');
  const [query, setQuery] = useState('');
  const [revealHidden, setRevealHidden] = useState(false);

  // Revealed rows join the list in their own categories rather than in a separate
  // block: an attribute's category is a fact about the attribute, not about
  // whether it happens to be hidden, and a second block would file the same
  // attribute in two places.
  const listed = useMemo(
    () => (revealHidden ? [...rows, ...hiddenRows] : [...rows]),
    [rows, hiddenRows, revealHidden],
  );

  const differenceCount = listed.filter((row) => isDifference(row.verdict)).length;
  const sharedCount = listed.length - differenceCount;

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return listed.filter((row) => {
      if (filter === 'differences' && !isDifference(row.verdict)) return false;
      if (filter === 'shared' && isDifference(row.verdict)) return false;
      if (needle === '') return true;
      return (
        row.label.toLowerCase().includes(needle) ||
        row.name.toLowerCase().includes(needle) ||
        row.contextValue.toLowerCase().includes(needle) ||
        row.comparedValue.toLowerCase().includes(needle)
      );
    });
  }, [listed, filter, query]);

  const blocks = useMemo(
    () => buildBlocks(visible, config.categories),
    [visible, config.categories],
  );

  return (
    // Viewport-derived rather than `h-full`, for the reason `ComparisonDiffTab`
    // documents: there is no definite-height chain to inherit in the side panel.
    <div className="flex min-h-[calc(100vh-22rem)] flex-1 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <FilterPill active={filter === 'differences'} onClick={() => setFilter('differences')}>
          Differences {differenceCount}
        </FilterPill>
        <FilterPill active={filter === 'shared'} onClick={() => setFilter('shared')}>
          Shared {sharedCount}
        </FilterPill>
        <FilterPill active={filter === 'all'} onClick={() => setFilter('all')}>
          All {listed.length}
        </FilterPill>
      </div>

      <Input
        type="search"
        value={query}
        onChange={setQuery}
        placeholder="Filter attributes…"
        ariaLabel="Filter attributes by name or value"
      />

      {hiddenDifferences > 0 && (
        <p className="flex flex-wrap items-center gap-1 text-xs text-neutral-600">
          <span>
            {hiddenDifferences === 1
              ? '1 differing attribute hidden by your display config'
              : `${hiddenDifferences} differing attributes hidden by your display config`}
          </span>
          <Button variant="ghost" size="sm" onClick={() => setRevealHidden((shown) => !shown)}>
            {revealHidden ? 'Hide' : 'Show'}
          </Button>
        </p>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-neutral-200 bg-white">
        {blocks.length === 0 ? (
          <EmptyState
            icon="list"
            title={listed.length === 0 ? 'No attributes to compare' : 'No attributes match'}
            description={
              listed.length === 0
                ? 'Neither user has any profile attributes this org defines.'
                : 'No attribute matches this filter. Try another term, or switch to All.'
            }
          />
        ) : (
          <div className="scrollable-list min-h-0 flex-1 divide-y divide-neutral-100 overflow-y-auto">
            {blocks.map((block) => (
              <section key={block.key}>
                <Eyebrow as="div" className="px-3 pt-3 pb-1">
                  {block.name}
                </Eyebrow>
                <ul aria-label={block.name} className="divide-y divide-neutral-100">
                  {block.rows.map((row) => (
                    <ComparisonAttributeRow
                      key={row.key}
                      row={row}
                      contextName={contextName}
                      comparedName={comparedName}
                      showApiNames={config.showApiNames}
                      readers={config.showRuleChips ? ruleReads[row.name] : undefined}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ComparisonAttributesTab;
