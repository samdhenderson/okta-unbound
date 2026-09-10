/**
 * @module sidepanel/components/users/profileDisplayOps
 * @description Every edit the inline profile-display editor can make, expressed as
 * a pure transform from one {@link ProfileDisplayConfig} to the next.
 *
 * Pure and I/O-free, like its neighbour
 * {@link module:sidepanel/components/users/profileAttributeBlocks}: no React, no
 * DOM, nothing persisted. The editor owns a draft config and calls these; the
 * components stay dumb, and the interesting rules stay testable in one file.
 *
 * Two invariants earn this module its existence.
 *
 * **A map patch is always whole.** `useProfileDisplayConfig`'s `mergeRecord` takes
 * every *known* attribute from the patch alone, so a one-key `assign` or `hidden`
 * patch does not update one attribute — it un-files every other one. Every
 * transform here emits the complete map via {@link completeAssign} /
 * {@link completeHidden}, which is the only way a call site can be prevented from
 * re-introducing that bug.
 *
 * **`attrOrder` is partitioned in section order.** The stored order is one flat
 * array while the pane renders sections, so a naive index into it steps over
 * attributes belonging to other categories. Rather than teach every caller to
 * index within a section, the transforms that can disturb placement rewrite
 * `attrOrder` as the concatenation of each section's members in
 * {@link sectionOrder} order — after which the flat array and the render agree by
 * construction.
 *
 * Security: category names, attribute names and attribute values are untrusted
 * tenant data and frequently PII. Nothing here logs, and nothing leaves this
 * module but the config the caller passed in, transformed.
 */
import type {
  ProfileDisplayCategory,
  ProfileDisplayConfig,
} from '../../../shared/storage/profileDisplayStore';
import type { AttributeDescriptor } from './profileAttributes';
import { UNCATEGORIZED, UNCATEGORIZED_LABEL } from './profileAttributeBlocks';

/**
 * One keyboard move of an attribute.
 *
 * `up`/`down` move within the attribute's own section and step into the adjacent
 * section at its boundary — the end of the previous one, the start of the next —
 * so repeated presses walk the whole profile. `prev-section`/`next-section` jump
 * a whole section, appending to the end of the one they land in.
 */
export type AttributeStep = 'up' | 'down' | 'prev-section' | 'next-section';

/**
 * Derive a stable kebab-case key from an admin-typed category name, keeping it
 * unique against the keys already in use.
 *
 * Keys are derived rather than randomised so the same name yields the same key
 * on any machine — which is what makes a story or a test able to assert on the
 * emitted patch at all. A name with no key-safe characters (e.g. one written
 * entirely in a non-Latin script) falls back to a positional key.
 *
 * @param name - The name the admin typed.
 * @param taken - Keys already used by existing categories.
 */
export function categoryKeyFor(name: string, taken: ReadonlySet<string>): string {
  const slug =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || `category-${taken.size + 1}`;
  if (!taken.has(slug)) return slug;
  let suffix = 2;
  while (taken.has(`${slug}-${suffix}`)) suffix += 1;
  return `${slug}-${suffix}`;
}

/** The category key an attribute resolves to, with a deleted category folded to Uncategorized. */
function resolveKey(config: ProfileDisplayConfig, name: string): string {
  const assigned = config.assign[name];
  if (!assigned) return UNCATEGORIZED;
  return config.categories.some((category) => category.key === assigned) ? assigned : UNCATEGORIZED;
}

/** The section an attribute is being moved into, with an unknown key folded to Uncategorized. */
function resolveTarget(config: ProfileDisplayConfig, key: string): string {
  if (!key) return UNCATEGORIZED;
  return config.categories.some((category) => category.key === key) ? key : UNCATEGORIZED;
}

/**
 * Every attribute name once, in the admin's order — the configured order first,
 * then anything the org has grown since the config was written.
 *
 * Mirrors `buildAttributeBlocks`: an attribute the config never placed is
 * appended rather than dropped, so the repartitioned `attrOrder` covers exactly
 * the attributes that exist.
 */
function orderedNames(
  config: ProfileDisplayConfig,
  attributes: readonly AttributeDescriptor[],
): string[] {
  const known = new Set(attributes.map((attribute) => attribute.name));
  const ordered = [...new Set(config.attrOrder.filter((name) => known.has(name)))];
  const placed = new Set(ordered);
  for (const name of known) {
    if (!placed.has(name)) ordered.push(name);
  }
  return ordered;
}

/**
 * Rewrite `attrOrder` as each section's members, concatenated in section order.
 *
 * @param config - The config whose `assign`/`categories` are already final.
 * @param names - Every attribute name once, in the order to preserve *within* a
 *   section.
 */
function partition(config: ProfileDisplayConfig, names: readonly string[]): string[] {
  const buckets = new Map<string, string[]>();
  for (const name of names) {
    const key = resolveKey(config, name);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(name);
    else buckets.set(key, [name]);
  }
  return sectionOrder(config).flatMap((section) => buckets.get(section.key) ?? []);
}

/**
 * The complete attribute-to-category map, covering every attribute on the
 * profile.
 *
 * Whole rather than partial because the store merges a record patch by taking
 * every *known* attribute from the patch alone: a one-key map does not leave the
 * others alone, it un-files them. Assignments to a category that no longer exists
 * resolve to {@link UNCATEGORIZED}, matching what the pane already renders.
 *
 * @param attributes - Every attribute on this profile — the set the map must cover.
 * @param config - The config the current assignments are read from.
 * @param overrides - Placements to apply on top, keyed by attribute name.
 * @returns A map with one entry per attribute in `attributes`.
 */
export function completeAssign(
  attributes: readonly AttributeDescriptor[],
  config: ProfileDisplayConfig,
  overrides: Readonly<Record<string, string>> = {},
): Record<string, string> {
  const assign: Record<string, string> = {};
  for (const attribute of attributes) {
    const override = overrides[attribute.name];
    assign[attribute.name] =
      override === undefined ? resolveKey(config, attribute.name) : resolveTarget(config, override);
  }
  return assign;
}

/**
 * The complete attribute-to-hidden map, covering every attribute on the profile —
 * including the visible ones, written explicitly as `false`.
 *
 * Same merge trap as {@link completeAssign}: a patch naming only the attribute
 * just toggled would make every other attribute visible again.
 *
 * @param attributes - Every attribute on this profile — the set the map must cover.
 * @param config - The config the current visibility is read from.
 * @param overrides - Visibility to apply on top, keyed by attribute name.
 * @returns A map with one entry per attribute in `attributes`.
 */
export function completeHidden(
  attributes: readonly AttributeDescriptor[],
  config: ProfileDisplayConfig,
  overrides: Readonly<Record<string, boolean>> = {},
): Record<string, boolean> {
  const hidden: Record<string, boolean> = {};
  for (const attribute of attributes) {
    const override = overrides[attribute.name];
    hidden[attribute.name] =
      override === undefined ? config.hidden[attribute.name] === true : override;
  }
  return hidden;
}

/**
 * The sections the editor renders, in order: the admin's categories, then
 * Uncategorized.
 *
 * Uncategorized is appended rather than stored so it can never be renamed,
 * reordered, or deleted — it is the block that guarantees no attribute can drop
 * out of sight.
 *
 * @param config - The config being edited.
 * @returns Categories in their configured order, with the Uncategorized section last.
 */
export function sectionOrder(config: ProfileDisplayConfig): ReadonlyArray<ProfileDisplayCategory> {
  return [...config.categories, { key: UNCATEGORIZED, name: UNCATEGORIZED_LABEL }];
}

/**
 * The attribute names filed under one section, in the admin's order.
 *
 * @param config - The config being read.
 * @param key - A category key, or {@link UNCATEGORIZED}.
 * @returns `attrOrder` filtered to that section. An attribute with no assignment,
 *   or one filed under a since-deleted category, counts as Uncategorized — the
 *   same fallback `buildAttributeBlocks` applies, so the editor and the pane
 *   never disagree about where a row lives.
 */
export function namesInSection(config: ProfileDisplayConfig, key: string): string[] {
  const section = resolveTarget(config, key);
  return config.attrOrder.filter((name) => resolveKey(config, name) === section);
}

/**
 * Where an attribute sits *within its own section*, which is the only position an
 * admin can see and the only one an announcement can honestly quote.
 *
 * @param config - The config being read.
 * @param name - The attribute's Okta name.
 * @returns The zero-based index in its section, or `-1` when `attrOrder` does not
 *   mention the attribute.
 */
export function indexOfAttribute(config: ProfileDisplayConfig, name: string): number {
  return namesInSection(config, resolveKey(config, name)).indexOf(name);
}

/**
 * Move one attribute into a section at a given position — the single transform
 * behind both a pointer drop and a keyboard move.
 *
 * Emits the whole `assign` map, and rewrites `attrOrder` as the concatenation of
 * every section's members in {@link sectionOrder} order, so the flat array can
 * never disagree with what is rendered.
 *
 * @param config - The config being edited.
 * @param attributes - Every attribute on this profile — the set `assign` must cover.
 * @param name - The attribute's Okta name.
 * @param targetKey - The destination category key, or {@link UNCATEGORIZED}. A key
 *   that names no existing category lands the attribute in Uncategorized.
 * @param index - The destination position within that section, clamped to the
 *   section's bounds once the attribute has been lifted out of its old place.
 * @returns A new config. The input is never mutated.
 */
export function placeAttribute(
  config: ProfileDisplayConfig,
  attributes: readonly AttributeDescriptor[],
  name: string,
  targetKey: string,
  index: number,
): ProfileDisplayConfig {
  const target = resolveTarget(config, targetKey);
  const assign = completeAssign(attributes, config, { [name]: target });
  const placed: ProfileDisplayConfig = { ...config, assign };

  const names = orderedNames(placed, attributes).filter((candidate) => candidate !== name);
  const attrOrder: string[] = [];
  for (const section of sectionOrder(placed)) {
    const members = names.filter((candidate) => resolveKey(placed, candidate) === section.key);
    if (section.key === target) {
      members.splice(Math.min(Math.max(index, 0), members.length), 0, name);
    }
    attrOrder.push(...members);
  }

  return { ...placed, attrOrder };
}

/**
 * Move one attribute by a single keyboard step.
 *
 * @param config - The config being edited.
 * @param attributes - Every attribute on this profile — the set `assign` must cover.
 * @param name - The attribute's Okta name.
 * @param direction - Which step to take (see {@link AttributeStep}).
 * @returns A new config, or **the same config object** when the step has nowhere
 *   to go — the first row of the first section pressing `up`, the last of the
 *   last pressing `down`. A no-op is returned unchanged rather than as an equal
 *   copy so a caller can tell "moved" from "at the edge" without diffing.
 */
export function stepAttribute(
  config: ProfileDisplayConfig,
  attributes: readonly AttributeDescriptor[],
  name: string,
  direction: AttributeStep,
): ProfileDisplayConfig {
  const sections = sectionOrder(config);
  const currentKey = resolveKey(config, name);
  const sectionIndex = sections.findIndex((section) => section.key === currentKey);
  if (sectionIndex === -1) return config;

  const members = namesInSection(config, currentKey);
  const position = members.indexOf(name);
  if (position === -1) return config;

  const previous = sections[sectionIndex - 1];
  const next = sections[sectionIndex + 1];

  switch (direction) {
    case 'up':
      if (position > 0) return placeAttribute(config, attributes, name, currentKey, position - 1);
      if (!previous) return config;
      return placeAttribute(
        config,
        attributes,
        name,
        previous.key,
        namesInSection(config, previous.key).length,
      );
    case 'down':
      if (position < members.length - 1) {
        return placeAttribute(config, attributes, name, currentKey, position + 1);
      }
      if (!next) return config;
      return placeAttribute(config, attributes, name, next.key, 0);
    case 'prev-section':
      if (!previous) return config;
      return placeAttribute(
        config,
        attributes,
        name,
        previous.key,
        namesInSection(config, previous.key).length,
      );
    case 'next-section':
      if (!next) return config;
      return placeAttribute(
        config,
        attributes,
        name,
        next.key,
        namesInSection(config, next.key).length,
      );
  }
}

/**
 * Move one category to a new position in the section list.
 *
 * @param config - The config being edited.
 * @param key - The category's stable key.
 * @param index - Destination index among the categories, clamped. Uncategorized is
 *   not in that list and stays pinned last.
 * @returns A new config with `attrOrder` repartitioned into the new section order.
 *   Unchanged when `key` names no category.
 */
export function moveCategory(
  config: ProfileDisplayConfig,
  key: string,
  index: number,
): ProfileDisplayConfig {
  const from = config.categories.findIndex((category) => category.key === key);
  if (from === -1) return config;

  const categories = [...config.categories];
  const [moved] = categories.splice(from, 1);
  categories.splice(Math.min(Math.max(index, 0), categories.length), 0, moved);

  const reordered: ProfileDisplayConfig = { ...config, categories };
  return { ...reordered, attrOrder: partition(reordered, config.attrOrder) };
}

/**
 * Rename one category.
 *
 * The key is deliberately left alone: it is what every `assign` entry points at,
 * so a rename that re-derived it would orphan the category's whole membership.
 *
 * @param config - The config being edited.
 * @param key - The category's stable key.
 * @param name - The new admin-facing label.
 * @returns A new config. Unchanged when `key` names no category.
 */
export function renameCategory(
  config: ProfileDisplayConfig,
  key: string,
  name: string,
): ProfileDisplayConfig {
  if (!config.categories.some((category) => category.key === key)) return config;
  return {
    ...config,
    categories: config.categories.map((category) =>
      category.key === key ? { ...category, name } : category,
    ),
  };
}

/**
 * Append a new, empty category.
 *
 * @param config - The config being edited.
 * @param name - The name the admin typed; trimmed. An empty name adds nothing.
 * @returns A new config whose last category carries a key derived by
 *   {@link categoryKeyFor} and unique against the existing ones.
 */
export function addCategory(config: ProfileDisplayConfig, name: string): ProfileDisplayConfig {
  const label = name.trim();
  if (label === '') return config;
  const taken = new Set(config.categories.map((category) => category.key));
  return {
    ...config,
    categories: [...config.categories, { key: categoryKeyFor(label, taken), name: label }],
  };
}

/**
 * Delete one category, returning its attributes to Uncategorized.
 *
 * `hidden` is not touched, and that is the load-bearing half: a category that took
 * its attributes off the profile with it would be a destructive action wearing an
 * editing action's clothes. Deleting a category is a reversible act — every
 * attribute it held is still on screen, one block further down.
 *
 * @param config - The config being edited.
 * @param attributes - Every attribute on this profile — the set `assign` must cover.
 * @param key - The category's stable key.
 * @returns A new config with the category gone, a whole `assign` map in which its
 *   members read {@link UNCATEGORIZED}, and `attrOrder` repartitioned. Unchanged
 *   when `key` names no category.
 */
export function deleteCategory(
  config: ProfileDisplayConfig,
  attributes: readonly AttributeDescriptor[],
  key: string,
): ProfileDisplayConfig {
  if (!config.categories.some((category) => category.key === key)) return config;

  const categories = config.categories.filter((category) => category.key !== key);
  // Dropping the category first is what re-files its members: `completeAssign`
  // resolves an assignment naming no existing category to Uncategorized.
  const shortened: ProfileDisplayConfig = { ...config, categories };
  const freed: ProfileDisplayConfig = {
    ...shortened,
    assign: completeAssign(attributes, shortened),
  };
  return { ...freed, attrOrder: partition(freed, orderedNames(freed, attributes)) };
}

/**
 * Flip one attribute's visibility in the profile pane.
 *
 * @param config - The config being edited.
 * @param attributes - Every attribute on this profile — the set `hidden` must cover.
 * @param name - The attribute's Okta name.
 * @returns A new config carrying the whole `hidden` map. Placement is untouched:
 *   a hidden attribute keeps its row in the editor, because an attribute you
 *   cannot find is an attribute you cannot bring back.
 */
export function toggleHidden(
  config: ProfileDisplayConfig,
  attributes: readonly AttributeDescriptor[],
  name: string,
): ProfileDisplayConfig {
  return {
    ...config,
    hidden: completeHidden(attributes, config, { [name]: config.hidden[name] !== true }),
  };
}
