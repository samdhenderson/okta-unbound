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
 * ## Either side is editable, and the marker does not follow the typing
 *
 * Given an {@link AttributeEditCell} for a side, that side's value cell
 * delegates to {@link ProfileEditCell} — the same cell the Users tab's Profile
 * pane renders, so an attribute locked in one surface is locked identically in
 * the other, with the same sentence saying why. A side with no cell is unchanged.
 *
 * The marker is **not** recomputed from the draft, and the row is never
 * re-sorted. `=` / `≠` states what Okta holds; flipping it on an unsaved
 * keystroke would claim two users now agree while the directory still says they
 * differ, and re-verdicting live would pull the row being typed in out from
 * under the cursor (the list is ordered differences-first). A dirty side gets an
 * `Edited` badge instead, whose tooltip says what saving *would* make true — a
 * sentence in the row, not an edit to the authoritative marker.
 *
 * ## Security
 *
 * Attribute names, labels and values are end-user-controllable tenant data and
 * frequently PII, as are the rule names in a chip's tooltip. They are rendered
 * through React's escaping only, and **nothing in this module logs**.
 */
import React from 'react';
import { Badge } from '../../shared';
import ProfileEditCell from '../ProfileEditCell';
import type { AttributeDescriptor } from '../profileAttributes';
import type { AttributeParityRow, AttributeVerdict } from './attributeParity';
import type { AttributeEditCell } from '../../../hooks/useProfileEdit';

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
  /**
   * The context user's editing cell for this attribute, joined by `row.name`.
   * **Present only while that column is editing** — absent renders the left cell
   * read-only, which is every other case.
   */
  contextCell?: AttributeEditCell;
  /** The compared user's editing cell for this attribute. Same contract as `contextCell`. */
  comparedCell?: AttributeEditCell;
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
 * The descriptor {@link ProfileEditCell} renders one side from — a **display
 * projection**, not the authoritative one. The parity row carries the same
 * stringified value `allProfileAttributes` put in `value`, plus the label and
 * kind, which is the whole of what the cell reads. `raw` is deliberately not
 * reconstructed: the descriptor the patch and the history entry are built from
 * lives in `useProfileEdit`'s own index, and a second, half-populated copy must
 * never be able to reach a write.
 */
const cellAttribute = (row: AttributeParityRow, value: string): AttributeDescriptor => ({
  key: row.key,
  name: row.name,
  label: row.label,
  kind: row.kind,
  value,
  raw: undefined,
  isEmpty: value === '',
});

/**
 * One side of a row: the user it belongs to, and their value — read-only, or the
 * control for it when that column is editing.
 *
 * `min-h-9` is `Button`'s own `sm` height, quoted from `ComparisonDiffTab` so an
 * attribute row and a group row stand on the same rhythm.
 */
const ValueCell: React.FC<{
  userName: string;
  row: AttributeParityRow;
  value: string;
  cell?: AttributeEditCell;
}> = ({ userName, row, value, cell }) => (
  <span
    className="flex min-h-9 min-w-0 flex-col justify-center gap-0.5 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1"
    // Only in read mode: a tooltip over a field the reader is typing into
    // repeats a value they can already see and covers the one they are entering.
    title={cell ? undefined : value === '' ? `${userName} has no value for this attribute` : value}
  >
    <span className="truncate text-xs text-neutral-500">{userName}</span>
    {cell ? (
      <ProfileEditCell
        attribute={cellAttribute(row, value)}
        editability={cell.editability}
        draft={cell.draft}
        // A cell only exists while this column is editing. Stated rather than
        // inferred from `onChange`, which a locked attribute does not carry.
        editing
        onChange={cell.onChange}
        invalid={cell.invalid}
      />
    ) : value === '' ? (
      <span className="text-xs text-neutral-400 italic">— not set</span>
    ) : (
      <span className="min-w-0 text-sm break-words text-pretty text-neutral-900">{value}</span>
    )}
  </span>
);

/**
 * What saving the current drafts *would* make true of this row — the hedge the
 * `Edited` badge carries, so the unchanged `=` / `≠` never has to be read as a
 * claim about the form.
 */
function hypothetical(contextValue: string, comparedValue: string): string {
  if (contextValue === comparedValue) {
    return contextValue === ''
      ? 'Saving would leave neither user with a value here.'
      : 'Saving would make the two values match.';
  }
  return 'The two values would still differ after saving.';
}

/**
 * The mark saying one side has an unsaved change here. It names its user in the
 * text as well as the tooltip: both columns can be dirty at once, and two bare
 * `Edited` marks would say nothing about which profile holds which edit.
 */
const EditedBadge: React.FC<{ userName: string; wouldBe: string }> = ({ userName, wouldBe }) => (
  <Badge
    variant="warning"
    title={`${userName} has an unsaved change to this attribute. The marker still describes what Okta holds today. ${wouldBe}`}
  >
    Edited<span className="sr-only">: {userName}</span>
  </Badge>
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
  contextCell,
  comparedCell,
}) => {
  const marker = markerFor(row.verdict, contextName, comparedName);
  // What each side would hold if saved right now — the hedge only, never the
  // marker. See the module header for why the verdict does not move.
  const wouldBe = hypothetical(
    contextCell?.draft ?? row.contextValue,
    comparedCell?.draft ?? row.comparedValue,
  );

  return (
    <li className="flex flex-col gap-1.5 px-(--sp-row-x) py-(--sp-row-y) hover:bg-neutral-50/70">
      <span className="flex min-w-0 flex-wrap items-center gap-(--sp-inline)">
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
        {contextCell?.dirty && <EditedBadge userName={contextName} wouldBe={wouldBe} />}
        {comparedCell?.dirty && <EditedBadge userName={comparedName} wouldBe={wouldBe} />}
      </span>

      {/* Real equal thirds: grid TRACKS, not `flex-1` boxes. See the module header.
          `gap-2` stays raw, not a spacing role — same reasoning as
          `ComparisonDiffTab`'s parity strip, which this one is quoted from. */}
      <span className="grid grid-cols-[minmax(0,1fr)_2rem_minmax(0,1fr)] items-stretch gap-2">
        <ValueCell userName={contextName} row={row} value={row.contextValue} cell={contextCell} />
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
        <ValueCell
          userName={comparedName}
          row={row}
          value={row.comparedValue}
          cell={comparedCell}
        />
      </span>
    </li>
  );
};

export default ComparisonAttributeRow;
