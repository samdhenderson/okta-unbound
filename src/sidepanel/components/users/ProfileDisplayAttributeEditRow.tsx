/**
 * @module sidepanel/components/users/ProfileDisplayAttributeEditRow
 * @description One attribute's row while the Profile pane is being customized:
 * grip, label, Okta name, a truncated value preview, and the eye that hides it.
 *
 * The row is presentational — every control leaves through a callback keyed by
 * the attribute's Okta name, so the editor emits one whole config and the row
 * never learns what a `ProfileDisplayConfig` is.
 *
 * **A hidden attribute keeps its row here, struck through.** Removing the row of
 * an attribute you just hid is how an attribute becomes unfindable: the only
 * control that could bring it back would have left the screen with it. The value
 * preview stays too, so an admin can tell which `department` they are restoring.
 *
 * Security: the label, the Okta name and the value are untrusted tenant data and
 * frequently PII. They are rendered through React's escaping only, and nothing
 * here logs.
 */
import React from 'react';
import { Badge, IconButton } from '../shared';
import Icon from '../shared/Icon';
import type { AttributeDescriptor } from './profileAttributes';
import ProfileDisplayGrip from './ProfileDisplayGrip';
import type { AttributeStep } from './profileDisplayOps';

/** Props for {@link ProfileDisplayAttributeEditRow}. */
export interface ProfileDisplayAttributeEditRowProps {
  /** The attribute this row describes. */
  attribute: AttributeDescriptor;
  /** Whether the attribute is hidden from the profile pane. */
  isHidden: boolean;
  /** `true` while this row is the one lifted. */
  isLifted: boolean;
  /** Names of the group rules that read this attribute; empty means no mark. */
  ruleNames: readonly string[];
  /** Turns the grip off while the pane's filter is narrowing the list. */
  isReorderDisabled?: boolean;
  /** `id` of the element describing the grip's keyboard contract. */
  gripDescribedBy?: string;
  /** Flip the attribute's visibility. */
  onToggleHidden: () => void;
  /** Start a pointer drag from the grip. */
  onGripPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => void;
  /** Lift this row with the keyboard. */
  onLift: () => void;
  /** Move the lifted row one step. */
  onStep: (direction: AttributeStep) => void;
  /** Drop the lifted row. */
  onDrop: () => void;
  /** Abandon the lift. */
  onCancelLift: () => void;
}

/**
 * One reorderable, hideable attribute.
 *
 * @example
 * ```tsx
 * <ProfileDisplayAttributeEditRow
 *   attribute={attribute}
 *   isHidden={draft.hidden[attribute.name] === true}
 *   isLifted={editor.drag?.id === attribute.name}
 *   ruleNames={ruleReads[attribute.name] ?? []}
 *   onToggleHidden={() => editor.toggleHidden(attribute.name)}
 *   … />
 * ```
 */
const ProfileDisplayAttributeEditRow: React.FC<ProfileDisplayAttributeEditRowProps> = ({
  attribute,
  isHidden,
  isLifted,
  ruleNames,
  isReorderDisabled = false,
  gripDescribedBy,
  onToggleHidden,
  onGripPointerDown,
  onLift,
  onStep,
  onDrop,
  onCancelLift,
}) => (
  <div
    data-row={attribute.name}
    className={`flex min-w-0 items-center gap-(--sp-inline) rounded-md px-(--sp-row-x) py-(--sp-row-y) ${
      isLifted ? 'bg-primary-light' : ''
    }`}
  >
    <ProfileDisplayGrip
      label={attribute.label}
      lifted={isLifted}
      disabled={isReorderDisabled}
      describedBy={gripDescribedBy}
      onPointerDown={onGripPointerDown}
      onLift={onLift}
      onStep={onStep}
      onDrop={onDrop}
      onCancel={onCancelLift}
    />

    <div className={`min-w-0 flex-1 ${isHidden ? 'opacity-60' : ''}`}>
      <div className="flex min-w-0 items-center gap-1.5">
        <span
          className={`truncate text-xs font-medium text-neutral-900 ${isHidden ? 'line-through' : ''}`}
        >
          {attribute.label}
        </span>
        <span className="shrink-0 truncate font-mono text-xs text-neutral-500">
          {attribute.name}
        </span>
        {ruleNames.length > 0 && (
          <Badge variant="primary" className="shrink-0" title={`Read by ${ruleNames.join(', ')}`}>
            rules
          </Badge>
        )}
      </div>
      {/* The value preview, in the treatment the configuration modal's row used:
          one truncated line, and the empty case stated in italics rather than
          left blank — a blank line reads as a rendering failure. */}
      <div className={`truncate text-xs text-neutral-500 ${attribute.isEmpty ? 'italic' : ''}`}>
        {attribute.isEmpty ? 'empty on this user' : attribute.value}
      </div>
    </div>

    <IconButton
      size="sm"
      variant="subtle"
      label={isHidden ? `Show ${attribute.label}` : `Hide ${attribute.label}`}
      active={isHidden}
      onClick={onToggleHidden}
    >
      <Icon type={isHidden ? 'eye-off' : 'eye'} size="sm" />
    </IconButton>
  </div>
);

export default ProfileDisplayAttributeEditRow;
