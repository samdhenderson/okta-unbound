/**
 * @module sidepanel/components/users/ProfileDisplayAttributesTab
 * @description The Attributes half of {@link module:sidepanel/components/users/ProfileDisplayModal}:
 * every attribute on the profile, whether it shows, which category it sits in,
 * and where within that category.
 *
 * Three things about the model are worth stating, because each is a decision
 * rather than an accident:
 *
 * - **The list is every attribute, including the empty ones and the hidden
 *   ones.** Filtering is a view over that list, never a deletion from it.
 * - **Order is one global array** (`attrOrder`) partitioned by `assign`, so
 *   moving an attribute "up" swaps it with the previous attribute *in its own
 *   category* — which may be several rows above it on screen. The arrows are
 *   disabled at that category's ends, not at the list's ends.
 * - **Record patches go out whole.** `assign` and `hidden` are emitted as a
 *   complete map for the known attributes, because the store merges a record
 *   patch by taking every known attribute from the patch alone; a one-key patch
 *   would silently un-file everything else.
 *
 * The tab tolerates a config whose `attrOrder` does not mention every attribute
 * (a hand-written default, a schema that just grew a field): unranked attributes
 * sort to the end in their incoming order rather than disappearing.
 */
import React, { useMemo, useState } from 'react';
import { FilterPill, Input } from '../shared';
import Icon from '../shared/Icon';
import type { ProfileDisplayConfig } from '../../../shared/storage/profileDisplayStore';
import type { AttributeDescriptor } from './profileAttributes';
import ProfileDisplayAttributeRow, {
  type AttributeCategoryOption,
} from './ProfileDisplayAttributeRow';

/** Props for {@link ProfileDisplayAttributesTab}. */
export interface ProfileDisplayAttributesTabProps {
  /** Every attribute on the profile, including the empty ones. */
  attributes: AttributeDescriptor[];
  /** The configuration being edited. */
  config: ProfileDisplayConfig;
  /** Emits one patch per edit, applied live by the caller. */
  onChange: (patch: Partial<ProfileDisplayConfig>) => void;
  /** Attribute name → the group rules that read it. Absent means rules are unknown. */
  ruleReads?: Record<string, string[]>;
}

/** Which subset of the attribute list is showing. */
type AttributeBucket = 'all' | 'base' | 'custom' | 'system' | 'uncategorized' | 'rules';

/** Where one attribute sits inside its own category. */
interface Placement {
  /** Zero-based position among the attributes filed under the same category. */
  index: number;
  /** How many attributes are filed under that category. */
  size: number;
}

/**
 * Sort the attributes into the admin's saved order.
 *
 * Attributes named in `attrOrder` come first, in that order; anything unranked
 * keeps its incoming position at the end. The sort is stable, so two attributes
 * sharing a rank (an org whose schema defines a custom attribute with the same
 * name as a top-level field) stay in their original relative order rather than
 * one of them vanishing.
 *
 * @param attributes - Every attribute on the profile.
 * @param attrOrder - The admin's global order, which may be partial or empty.
 */
function orderAttributes(
  attributes: AttributeDescriptor[],
  attrOrder: readonly string[],
): AttributeDescriptor[] {
  const rank = new Map<string, number>();
  attrOrder.forEach((name, index) => {
    if (!rank.has(name)) rank.set(name, index);
  });
  return [...attributes].sort(
    (a, b) =>
      (rank.get(a.name) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.name) ?? Number.MAX_SAFE_INTEGER),
  );
}

/** Every attribute, its visibility, its placement and the controls that change them. */
const ProfileDisplayAttributesTab: React.FC<ProfileDisplayAttributesTabProps> = ({
  attributes,
  config,
  onChange,
  ruleReads,
}) => {
  const [query, setQuery] = useState('');
  const [bucket, setBucket] = useState<AttributeBucket>('all');

  const ordered = useMemo(
    () => orderAttributes(attributes, config.attrOrder),
    [attributes, config.attrOrder],
  );

  /** The order edits are computed against — always complete, unlike `config.attrOrder`. */
  const effectiveOrder = useMemo(() => {
    const names: string[] = [];
    const seen = new Set<string>();
    for (const attribute of ordered) {
      if (seen.has(attribute.name)) continue;
      seen.add(attribute.name);
      names.push(attribute.name);
    }
    return names;
  }, [ordered]);

  /** Attribute name → its position within its own category. */
  const placements = useMemo(() => {
    const sizes = new Map<string, number>();
    const map = new Map<string, Placement>();
    for (const name of effectiveOrder) {
      const category = config.assign[name] ?? '';
      const index = sizes.get(category) ?? 0;
      sizes.set(category, index + 1);
      map.set(name, { index, size: 0 });
    }
    for (const [name, placement] of map) {
      const category = config.assign[name] ?? '';
      map.set(name, { ...placement, size: sizes.get(category) ?? 0 });
    }
    return map;
  }, [effectiveOrder, config.assign]);

  const uncategorizedCount = useMemo(
    () => effectiveOrder.filter((name) => (config.assign[name] ?? '') === '').length,
    [effectiveOrder, config.assign],
  );
  const hiddenCount = useMemo(
    () => effectiveOrder.filter((name) => Boolean(config.hidden[name])).length,
    [effectiveOrder, config.hidden],
  );

  const categoryOptions = useMemo<AttributeCategoryOption[]>(
    () => [
      { value: '', label: 'Uncategorized' },
      ...config.categories.map((category) => ({ value: category.key, label: category.name })),
    ],
    [config.categories],
  );

  const buckets: ReadonlyArray<{ key: AttributeBucket; label: string }> = [
    { key: 'all', label: `All ${attributes.length}` },
    { key: 'base', label: 'Base' },
    { key: 'custom', label: 'Custom' },
    { key: 'system', label: 'System' },
    { key: 'uncategorized', label: `Uncategorized ${uncategorizedCount}` },
    { key: 'rules', label: 'Read by rules' },
  ];

  const visibleRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return ordered.filter((attribute) => {
      if (bucket === 'uncategorized' && (config.assign[attribute.name] ?? '') !== '') return false;
      if (bucket === 'rules' && !(ruleReads?.[attribute.name]?.length ?? 0)) return false;
      if (
        (bucket === 'base' || bucket === 'custom' || bucket === 'system') &&
        attribute.kind !== bucket
      ) {
        return false;
      }
      if (needle === '') return true;
      return (
        attribute.name.toLowerCase().includes(needle) ||
        attribute.label.toLowerCase().includes(needle) ||
        attribute.value.toLowerCase().includes(needle)
      );
    });
  }, [ordered, bucket, query, config.assign, ruleReads]);

  const setVisible = (name: string, visible: boolean): void => {
    const hidden: Record<string, boolean> = {};
    for (const candidate of effectiveOrder) {
      const isHidden = candidate === name ? !visible : Boolean(config.hidden[candidate]);
      if (isHidden) hidden[candidate] = true;
    }
    onChange({ hidden });
  };

  const assign = (name: string, categoryKey: string): void => {
    const next: Record<string, string> = {};
    for (const candidate of effectiveOrder) {
      next[candidate] = candidate === name ? categoryKey : (config.assign[candidate] ?? '');
    }
    onChange({ assign: next });
  };

  const move = (name: string, direction: -1 | 1): void => {
    const category = config.assign[name] ?? '';
    // Global indices of this category's members, in order — the arrows step
    // through *these*, so an attribute never jumps out of its category.
    const positions = effectiveOrder.reduce<number[]>((slots, candidate, index) => {
      if ((config.assign[candidate] ?? '') === category) slots.push(index);
      return slots;
    }, []);
    const at = positions.findIndex((index) => effectiveOrder[index] === name);
    const target = at + direction;
    if (at === -1 || target < 0 || target >= positions.length) return;

    const attrOrder = [...effectiveOrder];
    const from = positions[at];
    const to = positions[target];
    [attrOrder[from], attrOrder[to]] = [attrOrder[to], attrOrder[from]];
    onChange({ attrOrder });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs text-neutral-600">
          Tick to show it, choose its category, reorder within it
        </span>
        <span className="shrink-0 text-xs text-neutral-500">
          {uncategorizedCount} uncategorized · {hiddenCount} hidden
        </span>
      </div>

      <Input
        size="sm"
        value={query}
        onChange={setQuery}
        type="search"
        ariaLabel="Find an attribute"
        placeholder="Find an attribute…"
        icon={<Icon type="search" size="sm" />}
      />

      <div className="flex flex-wrap gap-2" role="group" aria-label="Attribute filters">
        {buckets.map((option) => (
          <FilterPill
            key={option.key}
            active={bucket === option.key}
            onClick={() => setBucket(option.key)}
          >
            {option.label}
          </FilterPill>
        ))}
      </div>

      {/*
        `divide-y` on the container, not a border on each row: ADR-0029's second
        sanctioned pattern for a dense list inside one bordered container, the
        same one `ComparisonAttributesTab` uses.

        The scroll cap is a fixed height rather than a scale step because it is
        measured against the dialog, not the page — the list has to stop short
        enough that the modal's footer stays on screen at 360px, and no spacing
        token expresses "whatever is left above the footer".
      */}
      <div className="scrollable-list max-h-[300px] divide-y divide-neutral-100 overflow-y-auto rounded-md border border-neutral-200">
        {visibleRows.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-neutral-600">
            No attributes match this filter.
          </p>
        ) : (
          visibleRows.map((attribute) => {
            const placement = placements.get(attribute.name) ?? { index: 0, size: 1 };
            return (
              <ProfileDisplayAttributeRow
                key={attribute.key}
                attribute={attribute}
                categoryKey={config.assign[attribute.name] ?? ''}
                categoryOptions={categoryOptions}
                isHidden={Boolean(config.hidden[attribute.name])}
                canMoveUp={placement.index > 0}
                canMoveDown={placement.index < placement.size - 1}
                ruleNames={ruleReads?.[attribute.name] ?? []}
                onToggleVisible={setVisible}
                onAssign={assign}
                onMove={move}
              />
            );
          })
        )}
      </div>
    </div>
  );
};

export default ProfileDisplayAttributesTab;
