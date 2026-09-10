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
 * ## It renders; it does not fetch, and it holds no configuration
 *
 * `attributes` and `config` arrive as props rather than being pulled from
 * `allProfileAttributes` / `useProfileDisplayConfig` inside the component. That
 * keeps the pane pure and story-able, and follows `docs/components.md`'s "list
 * rows derive; they never fetch" — the rung above owns the hooks.
 *
 * The one dialog left in the picture is the save confirmation: `Save` calls
 * {@link ProfileEditControls.onSave}, and {@link
 * module:sidepanel/components/users/UserDetailPanel} mounts the modal. A pane
 * that owned a live-write confirmation could not be rendered in a story without
 * one.
 *
 * ## Three modes, two of them editors
 *
 * Display customization used to be a modal over this pane. It is now
 * `ProfileDisplayEditor`, rendered **here, in place of the section list**, so
 * the categories being dragged are the categories on screen rather than a
 * second copy of them in a dialog. The pane still holds no configuration state:
 * the editor owns a local draft and hands the **whole** config back through
 * {@link ProfileDisplayCustomizeControls.onCommit} on Done, so a Cancel leaves
 * nothing behind and a commit can never be a one-key patch.
 *
 * That makes value-editing and display-customizing mutually exclusive — both
 * take over the same rows — which is why the header omits the gear mid-draft
 * and the Edit button while customizing.
 *
 * ## Editing
 *
 * The pane is editable when the rung hands it {@link UserProfilePaneProps.edit}
 * and {@link UserProfilePaneProps.cells}. Neither is state it owns: the draft,
 * the diff and the write all live in
 * {@link module:sidepanel/hooks/useProfileEdit}, and the pane's only
 * contribution is where the controls appear. An attribute with a cell renders
 * its `<dd>` through `ProfileEditCell`; every other attribute renders exactly as
 * it does in read mode.
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
import Icon from '../shared/Icon';
import type { ProfileDisplayConfig } from '../../../shared/storage/profileDisplayStore';
import type { AttributeDescriptor } from './profileAttributes';
import { buildAttributeBlocks } from './profileAttributeBlocks';
import UserProfileAttributeList from './UserProfileAttributeList';
import UserProfilePaneHeader, {
  type ProfileDisplayCustomizeControls,
  type ProfileEditControls,
} from './UserProfilePaneHeader';
import ProfileDisplayEditor from './ProfileDisplayEditor';
import type { AttributeEditCell } from '../../hooks/useProfileEdit';

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
  /**
   * The display-customization mode flag and verbs. Absent renders no gear and
   * no editor — a surface that does not offer customization at all.
   */
  customize?: ProfileDisplayCustomizeControls;
  /** Render placeholders instead of the list while the profile/schema loads. */
  isLoading?: boolean;
  /**
   * The pane-level edit verbs and the state deciding which of them show. Absent
   * on a surface that does not offer editing at all — a story, or a rung with no
   * connected Okta tab.
   */
  edit?: ProfileEditControls;
  /**
   * Attribute Okta name → its edit cell, from `useProfileEdit`. Empty outside
   * edit mode, so it may be passed unconditionally; an attribute without a cell
   * renders read-only.
   */
  cells?: Readonly<Record<string, AttributeEditCell>>;
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
 *   customize={customizeControls}
 * />
 * ```
 */
const UserProfilePane: React.FC<UserProfilePaneProps> = ({
  attributes,
  config,
  ruleReads,
  customize,
  isLoading = false,
  edit,
  cells,
}) => {
  const [filter, setFilter] = useState('');
  const [onlyRuleRead, setOnlyRuleRead] = useState(false);

  const isCustomizing = customize?.isCustomizing ?? false;

  /**
   * Entering customize mode drops the `Used by rules` pill, and the editor is
   * never told about it: an editor that can only file the attributes some rule
   * happens to read would silently refuse to file the rest. The text filter is
   * carried in, because there it is a *find* — the editor honours it, and says
   * so by disabling its drag handles while it is set.
   */
  const beginCustomizing = (): void => {
    setOnlyRuleRead(false);
    customize?.onBegin();
  };

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

  // Omitted, not disabled, on a surface with no customization wired: an action
  // that cannot act is not offered.
  const configureActions = customize
    ? [{ label: 'Configure display', onClick: beginCustomizing, variant: 'secondary' as const }]
    : undefined;

  const isFiltered = filter.trim() !== '' || onlyRuleRead;
  const clearFilters = (): void => {
    setFilter('');
    setOnlyRuleRead(false);
  };

  return (
    <div>
      <UserProfilePaneHeader
        shown={shown}
        total={total}
        ruleReadCount={readCount}
        customize={customize && { ...customize, onBegin: beginCustomizing }}
        edit={edit}
      />

      <div className="px-(--sp-card) pb-(--sp-card) space-y-(--sp-field)">
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
        <div className="flex flex-wrap gap-(--sp-inline)">
          <FilterPill active={!onlyRuleRead} onClick={() => setOnlyRuleRead(false)}>
            All attributes
          </FilterPill>
          <FilterPill active={onlyRuleRead} onClick={() => setOnlyRuleRead(true)}>
            Used by rules
          </FilterPill>
        </div>
      </div>

      {isCustomizing && customize ? (
        // The whole of customize mode is one component: the pane is at its
        // ~300-line ceiling (`docs/state-management.md`), and the draft, the
        // drag machine and the option strip all belong to the editor anyway.
        <ProfileDisplayEditor
          attributes={attributes}
          config={config}
          ruleReads={ruleReads}
          filter={filter}
          onCommit={customize.onCommit}
          onCancel={customize.onCancel}
        />
      ) : isLoading ? (
        <div className="px-(--sp-card) pb-(--sp-card)">
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
            actions={configureActions}
          />
        )
      ) : (
        <div>
          {blocks.map((block) => (
            <section
              key={block.key}
              aria-label={block.name}
              className="border-t border-neutral-200 p-(--sp-card) first:border-t-0"
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
                cells={cells}
              />
            </section>
          ))}
        </div>
      )}
    </div>
  );
};

export default UserProfilePane;
