/**
 * @module sidepanel/components/users/comparison/attributeParity
 * @description The pure row model behind the two-user comparison's Attributes
 * dimension — a value diff, not a set diff.
 *
 * No React and no I/O, like its neighbour
 * {@link module:sidepanel/components/users/comparison/comparisonAnalytics} — the
 * whole projection is unit-testable without rendering anything.
 *
 * **Why this is not a widened `ParityRow`.** Groups and apps are *set
 * membership*: a row exists because at least one user holds the item, which is
 * exactly what `ParityRow`'s `inContext`/`inCompared` pair encodes and why those
 * two are never both `false`. Profile attributes do not work that way — both
 * users usually *have* `department`, and what an admin needs to see is that the
 * two values disagree. Folding a value diff into a presence-only type would break
 * that invariant and hand every group and app row two fields they can never use.
 * (`DiffItem.membership` is the precedent for a facet-specific payload, but that
 * is an extra fact *about* a presence row, not a different kind of row.)
 *
 * **The tab is editable; a row is still not.** Either user's profile can be
 * edited from the Attributes tab, and none of that arrives here. The editors are
 * keyed on `(user, attributes)` and hand back cells keyed by the bare attribute
 * `name`, which the row component joins to `AttributeParityRow.name` at render
 * time — so one editor serves both columns and this type keeps carrying exactly
 * what it always did. Widening it with a draft or a dirty flag would make a
 * derived fact carry mutable state, which is the same objection this module
 * already raises about `ParityRow`. The `verdict` likewise never moves for a
 * draft: it is a statement about what Okta holds, and re-verdicting an unsaved
 * keystroke would claim two users agree while the directory says they differ.
 *
 * **Attributes are deliberately excluded from the similarity score.**
 * `overallSimilarity` averages exactly two Jaccard terms — groups and apps — and
 * publishes the result as a number in the hero. Attributes are not access, and
 * folding them in would silently change what that number means to anyone who has
 * read it before. Nothing here feeds it.
 *
 * **The admin's display configuration is honoured, not reinvented.** Categories,
 * order, labels and visibility come from the same {@link ProfileDisplayConfig}
 * the Profile pane uses, and category resolution matches
 * {@link module:sidepanel/components/users/profileAttributeBlocks} exactly — an
 * assignment pointing at a category the admin has since deleted falls to
 * Uncategorized rather than vanishing, in both places. Two different groupings
 * from one config would be a bug an admin could never explain.
 *
 * Security: attribute names, labels and values are untrusted tenant data and
 * frequently PII. **Nothing here logs**, values are only ever compared and handed
 * back for React to escape, and security-sensitive keys are already removed
 * upstream by `allProfileAttributes`'s `isExcludedProfileField` filter — this
 * module adds no source that could reintroduce one.
 */
import type { OktaUser } from '../../../../shared/types';
import type { OktaUserProfileSchema } from '../../../../shared/schemas/okta';
import type { ProfileDisplayConfig } from '../../../../shared/storage/profileDisplayStore';
import {
  allProfileAttributes,
  type AttributeDescriptor,
  type AttributeKind,
} from '../profileAttributes';
import { UNCATEGORIZED } from '../profileAttributeBlocks';

/**
 * How one attribute's two values relate.
 *
 * - `same` — both sides non-empty and equal.
 * - `differs` — both sides non-empty and unequal.
 * - `onlyContext` / `onlyCompared` — exactly one side has a value.
 * - `bothEmpty` — neither side has one; the attribute exists in the org but is
 *   unset on both users.
 *
 * Only the middle three count as "a difference" (see {@link isDifference}):
 * `bothEmpty` is an absence of information, not a disagreement, and counting it
 * would bury the rows an admin can act on under every unused custom attribute in
 * the org.
 */
export type AttributeVerdict = 'same' | 'differs' | 'onlyContext' | 'onlyCompared' | 'bothEmpty';

/**
 * One attribute, and how the two users' values for it compare.
 *
 * All fields `readonly`, matching `ParityRow` — a row is a derived fact
 * about a pair of users, and nothing downstream may edit it in place. That holds
 * even now the tab writes to profiles: an edit lives in the editor's own draft
 * and is joined back to a row by {@link AttributeParityRow.name}, never merged
 * into one.
 */
export interface AttributeParityRow {
  /** {@link AttributeDescriptor.key} — `'status'` for a top-level field, `'profile.<name>'` for a profile one. */
  readonly key: string;
  /** The attribute's bare Okta name — the join key the config, the rule reads and the schema all share. **Untrusted.** */
  readonly name: string;
  /** Human label from the schema, or a humanized name. **Untrusted** — render escaped, never log. */
  readonly label: string;
  /** Which source the attribute came from. */
  readonly kind: AttributeKind;
  /** The context user's (baseline's) stringified value; `''` when unset. **Untrusted, frequently PII.** */
  readonly contextValue: string;
  /** The compared user's stringified value; `''` when unset. **Untrusted, frequently PII.** */
  readonly comparedValue: string;
  /** How the two values relate. */
  readonly verdict: AttributeVerdict;
  /** The category this attribute lands in, or {@link UNCATEGORIZED} (`''`). */
  readonly categoryKey: string;
  /** `true` only on rows in {@link AttributeParityResult.hiddenRows}. */
  readonly hiddenByConfig: boolean;
}

/**
 * The Attributes dimension for one pair of users.
 *
 * `rows` and `hiddenRows` are disjoint, and both are ordered the same way. The
 * split exists so the UI can be honest about what it is not showing: a compare
 * that silently omitted the one differing attribute explaining an access gap
 * would be worse than no compare at all, so the hidden rows are kept and counted
 * rather than dropped.
 */
export interface AttributeParityResult {
  /** Rows the admin's configuration makes visible, differences first. */
  readonly rows: AttributeParityRow[];
  /** Rows `config.hidden` suppresses, kept whole so the UI can reveal them on demand. */
  readonly hiddenRows: AttributeParityRow[];
  /** How many of {@link hiddenRows} actually differ — the number behind "3 differing attributes hidden by your display config". */
  readonly hiddenDifferences: number;
  /** How many of {@link rows} differ. Hidden differences are counted separately, so the two sum to the total. */
  readonly differenceCount: number;
}

/**
 * Whether a verdict represents something an admin might act on.
 *
 * One definition, used by the ordering and both counts, so "differences first"
 * and "3 differences" can never disagree about what a difference is.
 */
function isDifference(verdict: AttributeVerdict): boolean {
  return verdict === 'differs' || verdict === 'onlyContext' || verdict === 'onlyCompared';
}

/** Classify one attribute from its two stringified values. */
function verdictOf(contextValue: string, comparedValue: string): AttributeVerdict {
  const contextEmpty = contextValue === '';
  const comparedEmpty = comparedValue === '';
  if (contextEmpty && comparedEmpty) return 'bothEmpty';
  if (comparedEmpty) return 'onlyContext';
  if (contextEmpty) return 'onlyCompared';
  return contextValue === comparedValue ? 'same' : 'differs';
}

/**
 * Index one user's inventory by Okta name, first occurrence winning.
 *
 * Keyed by `name` rather than `key` for the same reason `buildAttributeBlocks`
 * is: `name` is the vocabulary the config's `assign`, `attrOrder` and `hidden`
 * maps all speak, so a top-level field and a same-named profile key cannot both
 * claim one configured slot.
 */
function indexByName(
  descriptors: readonly AttributeDescriptor[],
): Map<string, AttributeDescriptor> {
  const byName = new Map<string, AttributeDescriptor>();
  for (const descriptor of descriptors) {
    if (!byName.has(descriptor.name)) byName.set(descriptor.name, descriptor);
  }
  return byName;
}

/**
 * Compare two users attribute by attribute, honouring the admin's profile
 * display configuration.
 *
 * The row set is the **union** of both users' inventories, never one side's: an
 * attribute the compared user carries and the context user's profile has never
 * mentioned still gets a row, because omitting it would hide precisely the kind
 * of difference this surface exists to find.
 *
 * @param contextUser - The baseline user (the left/`context` side).
 * @param comparedUser - The user being compared against the baseline.
 * @param schema - The org's profile schema, or `null` when that call failed;
 *   passed straight through to `allProfileAttributes`, which falls back to the
 *   static base-attribute list.
 * @param config - The admin's reconciled display configuration: categories and
 *   their order, per-attribute placement, `attrOrder`, `hidden` and `showEmpty`.
 * @returns Visible rows, hidden rows, and the two difference counts. Rows are
 *   ordered differences first, then the config's `attrOrder`, then A–Z by label —
 *   mirroring `byDifferenceThenName`: the rows an admin can act on rise on their
 *   own, so filtering stays a convenience rather than the only way to find them.
 *
 * @example
 * const { rows, hiddenDifferences } = attributeParityRows(a, b, schema, config);
 * const firstDisagreement = rows.find((row) => row.verdict === 'differs');
 */
export function attributeParityRows(
  contextUser: OktaUser,
  comparedUser: OktaUser,
  schema: OktaUserProfileSchema | null,
  config: ProfileDisplayConfig,
): AttributeParityResult {
  const contextByName = indexByName(allProfileAttributes(contextUser, schema));
  const comparedByName = indexByName(allProfileAttributes(comparedUser, schema));

  // Context order first, then whatever only the compared user carries — a
  // deterministic union that keeps the baseline's inventory as the spine.
  const names = [
    ...contextByName.keys(),
    ...[...comparedByName.keys()].filter((name) => !contextByName.has(name)),
  ];

  const categoryKeys = new Set(config.categories.map((category) => category.key));
  // A stale `attrOrder` entry (an attribute since removed from the org) simply
  // never matches, so it costs nothing but its index.
  const orderIndex = new Map(config.attrOrder.map((name, index) => [name, index]));

  const rows: AttributeParityRow[] = [];
  const hiddenRows: AttributeParityRow[] = [];

  for (const name of names) {
    // At least one side always has the descriptor; the other supplies `''`.
    const descriptor = contextByName.get(name) ?? comparedByName.get(name);
    if (!descriptor) continue;

    const contextValue = contextByName.get(name)?.value ?? '';
    const comparedValue = comparedByName.get(name)?.value ?? '';
    const verdict = verdictOf(contextValue, comparedValue);

    // `showEmpty` governs ONLY the rows where neither user has a value. A
    // one-sided value is a difference and survives regardless — suppressing it
    // here would hide exactly the differences that matter most.
    if (verdict === 'bothEmpty' && !config.showEmpty) continue;

    const assigned = config.assign[name];
    const hidden = config.hidden[name] === true;

    const row: AttributeParityRow = {
      key: descriptor.key,
      name: descriptor.name,
      label: descriptor.label,
      kind: descriptor.kind,
      contextValue,
      comparedValue,
      verdict,
      categoryKey: assigned && categoryKeys.has(assigned) ? assigned : UNCATEGORIZED,
      hiddenByConfig: hidden,
    };

    if (hidden) hiddenRows.push(row);
    else rows.push(row);
  }

  const byDifferenceThenConfigOrder = (a: AttributeParityRow, b: AttributeParityRow): number => {
    const rank = (row: AttributeParityRow) => (isDifference(row.verdict) ? 0 : 1);
    const placed = (row: AttributeParityRow) => orderIndex.get(row.name) ?? Number.MAX_SAFE_INTEGER;
    return rank(a) - rank(b) || placed(a) - placed(b) || a.label.localeCompare(b.label);
  };

  rows.sort(byDifferenceThenConfigOrder);
  hiddenRows.sort(byDifferenceThenConfigOrder);

  return {
    rows,
    hiddenRows,
    hiddenDifferences: hiddenRows.filter((row) => isDifference(row.verdict)).length,
    differenceCount: rows.filter((row) => isDifference(row.verdict)).length,
  };
}
