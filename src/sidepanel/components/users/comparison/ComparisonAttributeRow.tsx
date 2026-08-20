/**
 * @module sidepanel/components/users/comparison/ComparisonAttributeRow
 * @description One row of the comparison's Attributes tab: an attribute's name
 * and annotations, then the two users' **values** with an equality marker between.
 *
 * Split out of {@link ComparisonAttributesTab} so the tab holds its filters,
 * grouping and disclosure state while this holds the row contract, and so the row
 * can be reviewed at every verdict in one Storybook page.
 *
 * ## The strip is a grid, and the marker is not a control
 *
 * `grid-cols-[minmax(0,1fr)_2rem_minmax(0,1fr)]` with `min-h-9` cells, quoted
 * from {@link ComparisonDiffTab}: grid *tracks*, not `flex-1` boxes, because
 * under flex a padded cell keeps its own chrome before the free space is split —
 * which put the marker 9px off-centre and made the `=` column stagger down the
 * list. The middle cell borrows the silhouette without being interactive: a
 * `role="img"` span with a label, showing `=` or `≠`. Two different glyphs, so
 * the state never depends on colour. Both sides are always named, and there is no
 * arrow.
 *
 * ## Values wrap; they never truncate
 *
 * A truncated value is actively dangerous in a diff — two values differing only
 * in their tails would render identically beside a `≠` nobody could explain — so
 * the value cell wraps and takes whatever height it needs. Both cells sit in one
 * grid row, so a wrapped value keeps its opposite number the same height.
 *
 * An unset value is stated as `— not set` in the muted italic "non-answer"
 * register {@link AppScopeIndicator} and {@link GroupSourceIndicator} share,
 * never left as an empty box that could read as a rendering failure.
 *
 * ## No action
 *
 * There is deliberately no per-row control. Writing a profile attribute needs
 * prior-state capture and audit logging, which is a separate change; offering the
 * affordance before that exists would be the wrong kind of convenient.
 *
 * ## Security
 *
 * Attribute names, labels and values are end-user-controllable tenant data and
 * frequently PII, as are the rule names in a chip's tooltip. They are rendered
 * through React's escaping only, and **nothing in this module logs**.
 */
import React from 'react';
import { Badge } from '../../shared';
import type { AttributeParityRow, AttributeVerdict } from './attributeParity';

/** Props for {@link ComparisonAttributeRow}. */
export interface ComparisonAttributeRowProps {
  /** The attribute and both users' values for it, from `attributeParityRows`. */
  row: AttributeParityRow;
  /** Display name of the context user (baseline) — the LEFT cell. */
  contextName: string;
  /** Display name of the compared user — the RIGHT cell. */
  comparedName: string;
  /** Render the Okta name in mono instead of the human label (`config.showApiNames`). */
  showApiNames: boolean;
  /**
   * Names of the rules that read this attribute and currently grant either user
   * access. Absent or empty renders no chip — the map from `profileRuleReads`
   * never holds an empty array, so `undefined` is the ordinary "no rule reads
   * this" answer.
   */
  readers?: readonly string[];
}

/** `1 rule` / `3 rules` — the chip never says "rules" for one. */
const ruleChipLabel = (count: number): string => (count === 1 ? '1 rule' : `${count} rules`);

/**
 * Per-verdict marker glyph and its accessible name.
 *
 * `bothEmpty` takes `=` because the two users genuinely agree — they are both
 * unset. It is not counted as a difference anywhere, and a `≠` here would say the
 * opposite of what the row shows.
 */
function markerFor(
  verdict: AttributeVerdict,
  contextName: string,
  comparedName: string,
): { glyph: string; label: string; matched: boolean } {
  switch (verdict) {
    case 'same':
      return { glyph: '=', label: 'Both users have the same value', matched: true };
    case 'bothEmpty':
      return { glyph: '=', label: 'Neither user has a value', matched: true };
    case 'onlyContext':
      return { glyph: '≠', label: `Only ${contextName} has a value`, matched: false };
    case 'onlyCompared':
      return { glyph: '≠', label: `Only ${comparedName} has a value`, matched: false };
    default:
      return { glyph: '≠', label: 'The two users have different values', matched: false };
  }
}

/**
 * One side of a row: the user it belongs to, and their value.
 *
 * `min-h-9` is `Button`'s own `sm` height, quoted from `ComparisonDiffTab` so an
 * attribute row and a group row stand on the same rhythm.
 */
const ValueCell: React.FC<{ userName: string; value: string }> = ({ userName, value }) => (
  <span
    className="flex min-h-9 min-w-0 flex-col justify-center gap-0.5 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1"
    title={value === '' ? `${userName} has no value for this attribute` : value}
  >
    <span className="truncate text-xs text-neutral-500">{userName}</span>
    {value === '' ? (
      <span className="text-xs text-neutral-400 italic">— not set</span>
    ) : (
      <span className="min-w-0 text-sm break-words text-pretty text-neutral-900">{value}</span>
    )}
  </span>
);

/**
 * One attribute row of the Attributes tab.
 *
 * Rendered as an `<li>`: the tab is ADR-0029's second sanctioned separator
 * pattern — a dense, table-like surface where one bordered container holds
 * `divide-y divide-neutral-100` rows — so the row carries no card border of its
 * own and is not a `ListRow`.
 *
 * @param props - See {@link ComparisonAttributeRowProps}.
 */
const ComparisonAttributeRow: React.FC<ComparisonAttributeRowProps> = ({
  row,
  contextName,
  comparedName,
  showApiNames,
  readers,
}) => {
  const marker = markerFor(row.verdict, contextName, comparedName);

  return (
    <li className="flex flex-col gap-1.5 px-3 py-2 hover:bg-neutral-50/70">
      <span className="flex min-w-0 flex-wrap items-center gap-1.5">
        <span
          className={`min-w-0 truncate text-sm text-neutral-800 ${showApiNames ? 'font-mono' : ''}`}
          // The other name, so switching `showApiNames` never costs the reader the
          // one they know the attribute by.
          title={showApiNames ? row.label : row.name}
        >
          {showApiNames ? row.name : row.label}
        </span>
        {readers && readers.length > 0 && (
          <Badge variant="primary" title={`Read by: ${readers.join(', ')}`}>
            {ruleChipLabel(readers.length)}
          </Badge>
        )}
        {row.hiddenByConfig && (
          <Badge
            variant="neutral"
            title="Your display configuration hides this attribute. It is shown here because the two users differ on it."
          >
            Hidden
          </Badge>
        )}
      </span>

      {/* Real equal thirds: grid TRACKS, not `flex-1` boxes. See the module header. */}
      <span className="grid grid-cols-[minmax(0,1fr)_2rem_minmax(0,1fr)] items-stretch gap-2">
        <ValueCell userName={contextName} value={row.contextValue} />
        {/* Not a button, not focusable: a status that borrows the silhouette. */}
        <span
          role="img"
          aria-label={marker.label}
          title={marker.label}
          className={`flex min-h-9 items-center justify-center rounded-md border font-mono text-sm font-bold ${
            marker.matched
              ? 'border-success-light bg-success-light text-success-text'
              : 'border-warning-light bg-warning-light text-warning-text'
          }`}
        >
          {marker.glyph}
        </span>
        <ValueCell userName={comparedName} value={row.comparedValue} />
      </span>
    </li>
  );
};

export default ComparisonAttributeRow;
