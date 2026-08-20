/**
 * @module sidepanel/components/users/ProfileDisplayCategoriesTab
 * @description The Categories half of {@link module:sidepanel/components/users/ProfileDisplayModal}:
 * how the profile is laid out, what extra marks it carries, and the admin's own
 * list of categories.
 *
 * Every control is controlled by the caller's config and emits a
 * `Partial<ProfileDisplayConfig>` patch — this component holds exactly one piece
 * of local state, the half-typed name of a category that does not exist yet.
 *
 * **Deleting a category returns its attributes to Uncategorized.** The delete
 * handler therefore emits an `assign` patch alongside the shortened `categories`
 * list, rather than leaving the orphaned assignments to be swept up later: a
 * category that took its attributes off the profile with it would be a
 * destructive action wearing an editing action's clothes.
 */
import React, { useMemo, useState } from 'react';
import { Button, Checkbox, Eyebrow, FilterPill, IconButton, Input } from '../shared';
import Icon from '../overview/shared/Icon';
import type {
  ProfileDisplayCategory,
  ProfileDisplayConfig,
} from '../../../shared/storage/profileDisplayStore';
import type { AttributeDescriptor } from './profileAttributes';

/** Props for {@link ProfileDisplayCategoriesTab}. */
export interface ProfileDisplayCategoriesTabProps {
  /** Every attribute on the profile — the source of the per-category counts and the empty count. */
  attributes: AttributeDescriptor[];
  /** The configuration being edited. */
  config: ProfileDisplayConfig;
  /** Emits one patch per edit, applied live by the caller. */
  onChange: (patch: Partial<ProfileDisplayConfig>) => void;
}

/** The three layouts, in the order they are offered. */
const LAYOUT_OPTIONS: ReadonlyArray<{ value: ProfileDisplayConfig['layout']; label: string }> = [
  { value: 'rows', label: 'Label + value rows' },
  { value: 'compact', label: 'Compact rows' },
  { value: 'grid', label: 'Two-column cards' },
];

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
function categoryKeyFor(name: string, taken: ReadonlySet<string>): string {
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

/** `1 attribute` / `4 attributes` — the count beside a category's name. */
function attributeCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'attribute' : 'attributes'}`;
}

/**
 * Layout, display toggles, and the admin's category list.
 *
 * @example
 * ```tsx
 * <ProfileDisplayCategoriesTab attributes={attributes} config={config} onChange={update} />
 * ```
 */
const ProfileDisplayCategoriesTab: React.FC<ProfileDisplayCategoriesTabProps> = ({
  attributes,
  config,
  onChange,
}) => {
  const [newCategoryName, setNewCategoryName] = useState('');

  const emptyCount = useMemo(
    () => attributes.filter((attribute) => attribute.isEmpty).length,
    [attributes],
  );

  /** category key → how many of this profile's attributes are filed under it. */
  const countsByCategory = useMemo(() => {
    const counts = new Map<string, number>();
    for (const attribute of attributes) {
      const key = config.assign[attribute.name] ?? '';
      if (key === '') continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [attributes, config.assign]);

  const renameCategory = (index: number, name: string): void => {
    const categories = config.categories.map((category, position) =>
      position === index ? { ...category, name } : category,
    );
    onChange({ categories });
  };

  const moveCategory = (index: number, direction: -1 | 1): void => {
    const target = index + direction;
    if (target < 0 || target >= config.categories.length) return;
    const categories = [...config.categories];
    [categories[index], categories[target]] = [categories[target], categories[index]];
    onChange({ categories });
  };

  const deleteCategory = (category: ProfileDisplayCategory): void => {
    // The whole `assign` map is rebuilt, not just the freed attributes: the store
    // merges a record patch by taking every known attribute from the patch alone,
    // so a partial map would un-file attributes that were never touched.
    const assign: Record<string, string> = {};
    for (const attribute of attributes) {
      const current = config.assign[attribute.name] ?? '';
      assign[attribute.name] = current === category.key ? '' : current;
    }
    onChange({
      categories: config.categories.filter((candidate) => candidate.key !== category.key),
      assign,
    });
  };

  const addCategory = (): void => {
    const name = newCategoryName.trim();
    if (name === '') return;
    const taken = new Set(config.categories.map((category) => category.key));
    onChange({
      categories: [...config.categories, { key: categoryKeyFor(name, taken), name }],
    });
    setNewCategoryName('');
  };

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2">
        <Eyebrow>Layout</Eyebrow>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Layout">
          {LAYOUT_OPTIONS.map((option) => (
            <FilterPill
              key={option.value}
              active={config.layout === option.value}
              onClick={() => onChange({ layout: option.value })}
            >
              {option.label}
            </FilterPill>
          ))}
        </div>

        <div className="mt-1 flex flex-col gap-2">
          <Checkbox
            checked={config.showApiNames}
            onChange={(showApiNames) => onChange({ showApiNames })}
            label="Show Okta attribute names"
            description={
              <>
                Renders <span className="font-mono">department</span> instead of Department.
              </>
            }
          />
          <Checkbox
            checked={config.showRuleChips}
            onChange={(showRuleChips) => onChange({ showRuleChips })}
            label="Mark attributes read by rules"
            description="Flags each attribute a group rule reads to decide membership."
          />
          <Checkbox
            checked={config.showEmpty}
            onChange={(showEmpty) => onChange({ showEmpty })}
            label="Show attributes with no value"
            description={`${emptyCount} of ${attributes.length} ${
              attributes.length === 1 ? 'attribute is' : 'attributes are'
            } empty on this user.`}
          />
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <Eyebrow>Your categories</Eyebrow>

        <div className="flex flex-col gap-2">
          {config.categories.map((category, index) => (
            <div key={category.key} className="flex min-w-0 items-center gap-2">
              <div className="min-w-0 flex-1">
                <Input
                  size="sm"
                  value={category.name}
                  onChange={(name) => renameCategory(index, name)}
                  ariaLabel={`Category ${index + 1} name`}
                />
              </div>
              <span className="shrink-0 text-xs text-neutral-500">
                {attributeCountLabel(countsByCategory.get(category.key) ?? 0)}
              </span>
              <IconButton
                size="sm"
                label={`Move ${category.name} up`}
                disabled={index === 0}
                onClick={() => moveCategory(index, -1)}
              >
                <Icon type="chevron-right" size="xs" className="-rotate-90" />
              </IconButton>
              <IconButton
                size="sm"
                label={`Move ${category.name} down`}
                disabled={index === config.categories.length - 1}
                onClick={() => moveCategory(index, 1)}
              >
                <Icon type="chevron-right" size="xs" className="rotate-90" />
              </IconButton>
              <IconButton
                size="sm"
                variant="danger"
                label={`Delete ${category.name}`}
                onClick={() => deleteCategory(category)}
              >
                <Icon type="close" size="xs" />
              </IconButton>
            </div>
          ))}

          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <Input
                size="sm"
                value={newCategoryName}
                onChange={setNewCategoryName}
                ariaLabel="New category name"
                placeholder="New category"
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return;
                  event.preventDefault();
                  addCategory();
                }}
              />
            </div>
            <Button
              variant="secondary"
              size="sm"
              icon="plus"
              disabled={newCategoryName.trim() === ''}
              onClick={addCategory}
            >
              Add category
            </Button>
          </div>

          <p className="text-xs text-neutral-500">
            Deleting a category returns its attributes to Uncategorized.
          </p>
        </div>
      </section>
    </div>
  );
};

export default ProfileDisplayCategoriesTab;
