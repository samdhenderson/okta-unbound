/**
 * @module sidepanel/components/users/ProfileDisplayAttributeRow
 * @description One attribute's row inside the Attributes tab of
 * {@link module:sidepanel/components/users/ProfileDisplayModal}: show/hide, api
 * name, kind, rule mark, value preview, category, and its position within that
 * category.
 *
 * The row is presentational — every control is driven by props and every edit
 * leaves through a callback keyed by the attribute's Okta name, so the parent
 * can emit one whole-record patch rather than the row knowing what a
 * `ProfileDisplayConfig` is.
 *
 * **A hidden row stays in the list, dimmed.** Removing the row of an attribute
 * you just unticked is how an attribute becomes unfindable: the only control
 * that could bring it back would have left the screen with it.
 */
import React from 'react';
import { Badge, Checkbox, IconButton, Select } from '../shared';
import Icon from '../shared/Icon';
import type { AttributeDescriptor, AttributeKind } from './profileAttributes';

/** One `<option>` in the row's category dropdown. */
export interface AttributeCategoryOption {
  /** Category key; `''` is Uncategorized. */
  value: string;
  /** Visible label. */
  label: string;
}

/** Props for {@link ProfileDisplayAttributeRow}. */
export interface ProfileDisplayAttributeRowProps {
  /** The attribute this row describes. */
  attribute: AttributeDescriptor;
  /** The category it is currently filed under; `''` is Uncategorized. */
  categoryKey: string;
  /** Uncategorized plus the admin's categories, in display order. */
  categoryOptions: AttributeCategoryOption[];
  /** Whether the attribute is hidden from the profile pane. */
  isHidden: boolean;
  /** `false` when the attribute is already first within its category. */
  canMoveUp: boolean;
  /** `false` when the attribute is already last within its category. */
  canMoveDown: boolean;
  /** Names of the group rules that read this attribute; empty means no mark. */
  ruleNames: string[];
  /** Called with the attribute name and whether it should now be visible. */
  onToggleVisible: (name: string, visible: boolean) => void;
  /** Called with the attribute name and its new category key. */
  onAssign: (name: string, categoryKey: string) => void;
  /** Called with the attribute name and `-1` (earlier) or `1` (later) within its category. */
  onMove: (name: string, direction: -1 | 1) => void;
}

/** Short label per attribute source, shown beside the api name. */
const kindLabels: Record<AttributeKind, string> = {
  base: 'Base',
  custom: 'Custom',
  system: 'System',
};

/**
 * A single configurable attribute row.
 *
 * @example
 * ```tsx
 * <ProfileDisplayAttributeRow
 *   attribute={attribute}
 *   categoryKey={config.assign[attribute.name] ?? ''}
 *   categoryOptions={options}
 *   isHidden={Boolean(config.hidden[attribute.name])}
 *   canMoveUp={placement.index > 0}
 *   canMoveDown={placement.index < placement.size - 1}
 *   ruleNames={ruleReads?.[attribute.name] ?? []}
 *   onToggleVisible={setVisible}
 *   onAssign={assign}
 *   onMove={move}
 * />
 * ```
 */
const ProfileDisplayAttributeRow: React.FC<ProfileDisplayAttributeRowProps> = ({
  attribute,
  categoryKey,
  categoryOptions,
  isHidden,
  canMoveUp,
  canMoveDown,
  ruleNames,
  onToggleVisible,
  onAssign,
  onMove,
}) => (
  // No border of its own: the separators are the parent list's
  // `divide-y divide-neutral-100`, ADR-0029's second sanctioned pattern for a
  // dense list inside one bordered container. A per-row `border-t` +
  // `first:border-t-0` is the same idea spelled the way that ADR bans, and it
  // drifts the moment a row is reordered or conditionally rendered.
  <div className={`flex min-w-0 items-center gap-2 px-3 py-2 ${isHidden ? 'opacity-50' : ''}`}>
    <Checkbox
      checked={!isHidden}
      onChange={(visible) => onToggleVisible(attribute.name, visible)}
      aria-label={`Show ${attribute.name}`}
    />

    <div className="min-w-0 flex-1">
      <div className="flex min-w-0 items-center gap-1.5">
        <span
          className="truncate font-mono text-xs font-medium text-neutral-900"
          title={attribute.label}
        >
          {attribute.name}
        </span>
        <span className="shrink-0 text-xs text-neutral-500">{kindLabels[attribute.kind]}</span>
        {ruleNames.length > 0 && (
          <Badge variant="primary" className="shrink-0" title={`Read by ${ruleNames.join(', ')}`}>
            rules
          </Badge>
        )}
      </div>
      <div className={`truncate text-xs text-neutral-500 ${attribute.isEmpty ? 'italic' : ''}`}>
        {attribute.isEmpty ? 'empty on this user' : attribute.value}
      </div>
    </div>

    {/* The dropdown holds a fixed width so every row's arrows line up, stepping
        down at the 360px floor where a 144px control would leave the api name
        nothing to truncate into. */}
    <div className="w-28 shrink-0 sm:w-36">
      <Select
        value={categoryKey}
        onChange={(next) => onAssign(attribute.name, next)}
        options={categoryOptions}
        ariaLabel={`Category for ${attribute.name}`}
      />
    </div>

    <div className="flex shrink-0 flex-col">
      <IconButton
        size="sm"
        label={`Move ${attribute.name} up`}
        disabled={!canMoveUp}
        onClick={() => onMove(attribute.name, -1)}
      >
        <Icon type="chevron-right" size="xs" className="-rotate-90" />
      </IconButton>
      <IconButton
        size="sm"
        label={`Move ${attribute.name} down`}
        disabled={!canMoveDown}
        onClick={() => onMove(attribute.name, 1)}
      >
        <Icon type="chevron-right" size="xs" className="rotate-90" />
      </IconButton>
    </div>
  </div>
);

export default ProfileDisplayAttributeRow;
