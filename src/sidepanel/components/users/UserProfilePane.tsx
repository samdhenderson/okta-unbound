/**
 * @module sidepanel/components/users/UserProfilePane
 * @description The Profile pane of the user detail rung: every attribute of the
 * user's profile, in the admin's own categories and order, with the rules that
 * read them marked.
 *
 * ## The pane's argument
 *
 * `UserProfileCard`, which this replaces, was a data dump: fixed two-column tiles
 * that truncated the addresses and logins an admin came to read, hid every empty
 * attribute so "does this org even define X?" was unanswerable, and hard-coded
 * its own labels and section names so no two orgs' vocabularies fitted it.
 *
 * The argument here is different. **Attributes are the evidence group rules read
 * to grant access**, so a `{n} rules` chip sits beside any value a currently
 * granting rule consults (`profileRuleReads`). That chip is what turns a list of
 * strings into an explanation of this person's access — and it is why the header
 * counts "read by rules that grant access" beside the plain attribute count.
 *
 * ## It renders; it does not fetch, and it does not configure
 *
 * `attributes` and `config` arrive as props rather than being pulled from
 * `allProfileAttributes` / `useProfileDisplayConfig` inside the component. That
 * keeps the pane pure and story-able, and follows `docs/components.md`'s "list
 * rows derive; they never fetch" — the rung above owns the hooks. The gear does
 * not open anything either: it calls {@link UserProfilePaneProps.onConfigure},
 * and the configuration modal is a separate component.
 *
 * The grouping itself lives in `profileAttributeBlocks` — a pure module beside
 * this one, mirroring `profileAttributes` and `profileRuleReads` — so this file
 * holds state and chrome only.
 *
 * The filter text and the pill live in local state on purpose. Panes are hidden
 * rather than unmounted (ADR-0016/ADR-0018), so a filter typed here survives a
 * trip to the Groups pane and back without any of it being persisted.
 *
 * ## Security
 *
 * Every value on screen is end-user-controllable tenant data and frequently PII.
 * It is rendered through React's escaping only — `dangerouslySetInnerHTML` and
 * hand-built HTML strings are banned — and **nothing here logs**: not a value,
 * not an attribute name, not a rule name.
 */
import React, { useMemo, useState } from 'react';
import { Badge, EmptyState, Eyebrow, FilterPill, IconButton, Input, Skeleton } from '../shared';
import Icon from '../overview/shared/Icon';
import type { ProfileDisplayConfig } from '../../../shared/storage/profileDisplayStore';
import type { AttributeDescriptor } from './profileAttributes';
import { buildAttributeBlocks } from './profileAttributeBlocks';
import UserProfileAttributeList from './UserProfileAttributeList';

/** Props for {@link UserProfilePane}. */
export interface UserProfilePaneProps {
  /**
   * Every attribute of this user's profile from `allProfileAttributes` — empty
   * ones included, already filtered for security-sensitive keys. The pane decides
   * what to *show*; it never decides what exists.
   */
  attributes: readonly AttributeDescriptor[];
  /**
   * The admin's reconciled display configuration from `useProfileDisplayConfig`:
   * layout, the category list and its order, per-attribute placement, and the
   * four display toggles.
   */
  config: ProfileDisplayConfig;
  /**
   * Attribute Okta name to the names of the rules that read it *and* currently
   * grant this user access, from `profileRuleReads`. Attributes absent from the
   * map carry no chip; the map is never expected to hold an empty array.
   */
  ruleReads: Record<string, string[]>;
  /** Opens the "Configure attribute display" modal, which this pane does not own. */
  onConfigure: () => void;
  /** Render placeholders instead of the list while the profile/schema loads. */
  isLoading?: boolean;
}

/** `1 field` / `4 fields`. */
function fieldCountLabel(count: number): string {
  return count === 1 ? '1 field' : `${count} fields`;
}

/**
 * The user's profile attributes, grouped the way this admin reads profiles, with
 * the rules that read them marked.
 *
 * @example
 * ```tsx
 * <UserProfilePane
 *   attributes={allProfileAttributes(user, schema)}
 *   config={config}
 *   ruleReads={profileRuleReads(rules, user, memberships)}
 *   onConfigure={() => setConfigOpen(true)}
 * />
 * ```
 */
const UserProfilePane: React.FC<UserProfilePaneProps> = ({
  attributes,
  config,
  ruleReads,
  onConfigure,
  isLoading = false,
}) => {
  const [filter, setFilter] = useState('');
  const [onlyRuleRead, setOnlyRuleRead] = useState(false);

  const blocks = useMemo(
    () => buildAttributeBlocks(attributes, config, ruleReads, { filter, onlyRuleRead }),
    [attributes, config, ruleReads, filter, onlyRuleRead],
  );

  const shown = blocks.reduce((sum, block) => sum + block.attributes.length, 0);
  const total = new Set(attributes.map((attribute) => attribute.name)).size;
  const readCount = blocks.reduce(
    (sum, block) =>
      sum + block.attributes.filter((attribute) => ruleReads[attribute.name]?.length).length,
    0,
  );

  const isFiltered = filter.trim() !== '' || onlyRuleRead;
  const clearFilters = (): void => {
    setFilter('');
    setOnlyRuleRead(false);
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-3 px-4 py-3">
        <p className="text-xs text-neutral-600 text-pretty">
          {shown} of {total} attributes shown &middot; {readCount} read by rules that grant access
        </p>
        <IconButton
          label="Configure attribute display"
          variant="subtle"
          size="md"
          onClick={onConfigure}
          className="shrink-0"
        >
          <Icon type="settings" size="sm" />
        </IconButton>
      </div>

      <div className="px-4 pb-3 space-y-2">
        <Input
          size="sm"
          value={filter}
          onChange={setFilter}
          placeholder="Filter attributes…"
          ariaLabel="Filter attributes"
          icon={<Icon type="search" size="sm" />}
          trailingInteractive
          trailing={
            filter ? (
              <IconButton
                label="Clear attribute filter"
                variant="ghost"
                size="sm"
                onClick={() => setFilter('')}
              >
                <Icon type="close" size="sm" />
              </IconButton>
            ) : undefined
          }
        />
        <div className="flex flex-wrap gap-2">
          <FilterPill active={!onlyRuleRead} onClick={() => setOnlyRuleRead(false)}>
            All attributes
          </FilterPill>
          <FilterPill active={onlyRuleRead} onClick={() => setOnlyRuleRead(true)}>
            Used by rules
          </FilterPill>
        </div>
      </div>

      {isLoading ? (
        <div className="px-4 pb-4">
          <Skeleton variant="row" size="md" count={4} label="Loading profile attributes" />
        </div>
      ) : blocks.length === 0 ? (
        isFiltered ? (
          <EmptyState
            icon="search"
            title="No attributes match"
            description="Nothing in this profile matches the current filter."
            actions={[{ label: 'Clear filter', onClick: clearFilters, variant: 'secondary' }]}
          />
        ) : (
          <EmptyState
            icon="settings"
            title="No attributes to show"
            description="Every attribute is hidden, or empty on this user and set not to show."
            actions={[{ label: 'Configure display', onClick: onConfigure, variant: 'secondary' }]}
          />
        )
      ) : (
        <div>
          {blocks.map((block) => (
            <section
              key={block.key}
              aria-label={block.name}
              className="border-t border-neutral-200 px-4 py-3 first:border-t-0"
            >
              <div className="flex items-baseline justify-between gap-2 mb-2">
                <Eyebrow as="h3">{block.name}</Eyebrow>
                <Badge variant="neutral">{fieldCountLabel(block.attributes.length)}</Badge>
              </div>
              <UserProfileAttributeList
                attributes={block.attributes}
                layout={config.layout}
                showApiNames={config.showApiNames}
                showRuleChips={config.showRuleChips}
                ruleReads={ruleReads}
              />
            </section>
          ))}
        </div>
      )}
    </div>
  );
};

export default UserProfilePane;
