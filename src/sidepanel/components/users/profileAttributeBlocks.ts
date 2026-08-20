/**
 * @module sidepanel/components/users/profileAttributeBlocks
 * @description Projects a user's attribute inventory onto the admin's display
 * configuration and the Profile pane's live filters — the derivation half of
 * `UserProfilePane`.
 *
 * Pure and I/O-free, like its neighbours
 * {@link module:sidepanel/components/users/profileAttributes} and
 * {@link module:sidepanel/components/users/profileRuleReads}. The pane renders
 * what this returns and decides nothing about ordering or placement itself, which
 * is what keeps the pane inside its size budget and the placement rules readable
 * in one screen.
 *
 * **The Uncategorized block can never silently vanish.** An attribute the config
 * has not placed, and an attribute filed under a category the admin has since
 * deleted, both land there rather than dropping out of the list — that invariant
 * is what makes deleting a category a safe, reversible act instead of a way to
 * lose sight of an attribute.
 *
 * Security: attribute labels, names and values are untrusted tenant data and
 * frequently PII. Nothing here logs, and values are only ever compared, never
 * emitted anywhere but back to the caller for React to escape.
 */
import type { ProfileDisplayConfig } from '../../../shared/storage/profileDisplayStore';
import type { AttributeDescriptor } from './profileAttributes';

/**
 * The category key an attribute lands in when it has none — also the key of the
 * trailing block. `''` is the value `ProfileDisplayConfig.assign` already uses
 * for "uncategorized", so nothing has to be translated.
 */
export const UNCATEGORIZED = '';

/** Label of the block that collects everything the admin has not filed. */
export const UNCATEGORIZED_LABEL = 'Uncategorized';

/** One rendered category: its label and the attributes that survived filtering. */
export interface AttributeBlock {
  /** Category key, or {@link UNCATEGORIZED}. */
  key: string;
  /** The category's admin-authored name, or "Uncategorized". */
  name: string;
  /** Attributes in the configured order. Never empty — an empty block is dropped. */
  attributes: AttributeDescriptor[];
}

/** The pane's two live filters, which are local state rather than configuration. */
export interface AttributeBlockFilters {
  /** Free-text needle, matched against label, Okta name and value. Untrimmed. */
  filter: string;
  /** Keep only attributes some currently-granting rule reads. */
  onlyRuleRead: boolean;
}

/** Case-insensitive match across an attribute's label, Okta name and value. */
function matchesFilter(attribute: AttributeDescriptor, needle: string): boolean {
  if (needle === '') return true;
  return (
    attribute.label.toLowerCase().includes(needle) ||
    attribute.name.toLowerCase().includes(needle) ||
    attribute.value.toLowerCase().includes(needle)
  );
}

/**
 * Group a user's attributes into the admin's categories, in the admin's order,
 * with the config's visibility rules and the pane's filters applied.
 *
 * @param attributes - The whole inventory from `allProfileAttributes`, empty
 *   attributes included.
 * @param config - The reconciled display configuration: category list and order,
 *   per-attribute placement, `hidden` and `showEmpty`.
 * @param ruleReads - Attribute name to granting-rule names, from
 *   `profileRuleReads`; consulted only by the `onlyRuleRead` filter.
 * @param filters - The pane's live filter state.
 * @returns Non-empty blocks in `config.categories` order, with the Uncategorized
 *   block last when anything landed in it. Attributes the config has not placed
 *   are appended in inventory order rather than dropped, so an attribute added to
 *   the org since the config was written still appears.
 */
export function buildAttributeBlocks(
  attributes: readonly AttributeDescriptor[],
  config: ProfileDisplayConfig,
  ruleReads: Record<string, string[]>,
  filters: AttributeBlockFilters,
): AttributeBlock[] {
  const needle = filters.filter.trim().toLowerCase();
  const categoryKeys = new Set(config.categories.map((category) => category.key));

  // Keyed by Okta name because that is the vocabulary the config, the rule map
  // and the descriptors all share. First occurrence wins, so a top-level field
  // and a same-named profile key cannot both claim one configured slot.
  const byName = new Map<string, AttributeDescriptor>();
  for (const attribute of attributes) {
    if (!byName.has(attribute.name)) byName.set(attribute.name, attribute);
  }

  const placed = new Set(config.attrOrder);
  const ordered = [
    ...config.attrOrder.filter((name) => byName.has(name)),
    ...[...byName.keys()].filter((name) => !placed.has(name)),
  ];

  const buckets = new Map<string, AttributeDescriptor[]>();
  for (const name of ordered) {
    const attribute = byName.get(name);
    if (!attribute) continue;
    if (config.hidden[name]) continue;
    if (attribute.isEmpty && !config.showEmpty) continue;
    if (filters.onlyRuleRead && !ruleReads[name]?.length) continue;
    if (!matchesFilter(attribute, needle)) continue;

    const assigned = config.assign[name];
    const key = assigned && categoryKeys.has(assigned) ? assigned : UNCATEGORIZED;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(attribute);
    else buckets.set(key, [attribute]);
  }

  const blocks: AttributeBlock[] = [];
  for (const category of config.categories) {
    const bucket = buckets.get(category.key);
    if (bucket && bucket.length > 0) {
      blocks.push({ key: category.key, name: category.name, attributes: bucket });
    }
  }

  const leftovers = buckets.get(UNCATEGORIZED);
  if (leftovers && leftovers.length > 0) {
    blocks.push({ key: UNCATEGORIZED, name: UNCATEGORIZED_LABEL, attributes: leftovers });
  }

  return blocks;
}
