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
 * ## Editable, per side, without the marker following the typing
 *
 * Either user's profile can be edited from here — which user is right is exactly
 * what a value diff leaves the admin to decide, so the affordance has to work in
 * both directions. The controls live in {@link ComparisonAttributesToolbar}, one
 * cluster per user and each naming its user; the per-attribute cells come from a
 * {@link module:sidepanel/hooks/useProfileEdit} instance per side and are joined
 * to a row by the bare attribute `name`. `AttributeParityRow` is unchanged and
 * stays a derived fact about a pair of users — nothing here edits one in place.
 *
 * The prior-state capture and audit entry that used to make this "a separate
 * change" now exist: `useProfileEdit` records every write through
 * {@link module:shared/undoManager} and `ProfileSaveModal` restates every change
 * first. What has **not** changed is the arithmetic — the verdicts, the ordering
 * and the three pill counts still describe what Okta holds, never the form.
 *
 * ## A dirty hidden row is shown whether or not hidden rows are revealed
 *
 * A row the config hides can be revealed, edited, and then the disclosure
 * collapsed again — at which point the edit would be on screen nowhere and still
 * in the patch. Any row carrying a draft on either side is therefore listed
 * regardless of the disclosure, still marked `Hidden`.
 *
 * ## Security
 *
 * Attribute names, labels and values are end-user-controllable tenant data and
 * frequently PII, as are the rule names in a chip's tooltip. They are rendered
 * through React's escaping only — `dangerouslySetInnerHTML` and hand-built HTML
 * are banned — and **nothing in this module logs**.
 */
import React, { useMemo, useState } from 'react';
import { EmptyState, Eyebrow } from '../../shared';
import ComparisonAttributeRow from './ComparisonAttributeRow';
import ComparisonAttributesToolbar, { type AttributeFilter } from './ComparisonAttributesToolbar';
import { UNCATEGORIZED, UNCATEGORIZED_LABEL } from '../profileAttributeBlocks';
import type { AttributeParityRow, AttributeVerdict } from './attributeParity';
import type { ComparisonEditSide } from '../../../hooks/useComparisonProfileEdit';
import type { ProfileDisplayConfig } from '../../../../shared/storage/profileDisplayStore';

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
  /**
   * The context user's editor, from `useComparisonProfileEdit`. Absent leaves
   * the left column read-only — which is what every non-editing host, and every
   * story of this tab that is about the diff rather than the editing, passes.
   */
  contextEdit?: ComparisonEditSide;
  /** The compared user's editor. Same contract as `contextEdit`. */
  comparedEdit?: ComparisonEditSide;
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
  contextEdit,
  comparedEdit,
}) => {
  const [filter, setFilter] = useState<AttributeFilter>('differences');
  const [query, setQuery] = useState('');
  const [revealHidden, setRevealHidden] = useState(false);

  const contextCells = contextEdit?.cells;
  const comparedCells = comparedEdit?.cells;

  // Attribute names carrying an unsaved draft on either side. Both maps are
  // empty unless their column is editing, so this is an empty set in every
  // read-only render.
  const dirtyNames = useMemo(() => {
    const names = new Set<string>();
    for (const cells of [contextCells, comparedCells]) {
      if (cells === undefined) continue;
      for (const cell of Object.values(cells)) if (cell.dirty) names.add(cell.name);
    }
    return names;
  }, [contextCells, comparedCells]);

  // Revealed rows join the list in their own categories rather than in a separate
  // block: an attribute's category is a fact about the attribute, not about
  // whether it happens to be hidden, and a second block would file the same
  // attribute in two places.
  //
  // A hidden row holding a draft is listed either way. Collapsing the disclosure
  // over one would take the edit off screen without taking it out of the patch.
  const listed = useMemo(
    () =>
      revealHidden
        ? [...rows, ...hiddenRows]
        : [...rows, ...hiddenRows.filter((row) => dirtyNames.has(row.name))],
    [rows, hiddenRows, revealHidden, dirtyNames],
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
      <ComparisonAttributesToolbar
        filter={filter}
        onFilterChange={setFilter}
        differenceCount={differenceCount}
        sharedCount={sharedCount}
        totalCount={listed.length}
        query={query}
        onQueryChange={setQuery}
        hiddenDifferences={hiddenDifferences}
        revealHidden={revealHidden}
        onToggleHidden={() => setRevealHidden((shown) => !shown)}
        contextEdit={contextEdit}
        comparedEdit={comparedEdit}
      />

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
                      // Joined by the bare attribute name, which is the key the
                      // parity row, the display config, the rule reads and both
                      // editors already share. Undefined — the read-only case —
                      // whenever that column is not editing.
                      contextCell={contextCells?.[row.name]}
                      comparedCell={comparedCells?.[row.name]}
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
