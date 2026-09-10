/**
 * @module sidepanel/components/users/ProfileDisplayGrip
 * @description The reorder handle used by both halves of customize mode — one on
 * every attribute row, one on every section.
 *
 * It exists as its own component because a handle that only worked with a
 * pointer would put the whole feature out of reach of a keyboard: the same
 * control has to start a drag on `pointerdown` *and* run a lift-step-drop
 * conversation on its own key events, and writing that twice is how the two
 * inputs drift apart.
 *
 * The keyboard contract is the platform convention for a reorderable list:
 * **Space or Enter** lifts, then drops; **the arrow keys** move — up/down within
 * and across sections, left/right a whole section at a time; **Escape** puts it
 * back. `aria-pressed` carries the lifted state, so a screen reader can tell a
 * held item from a resting one without reading the live region.
 *
 * The handle also **takes focus back after every keyboard move.** A move
 * re-parents the row into another section, which unmounts and remounts it, and a
 * handle that lost focus mid-lift would leave the admin holding an item they can
 * no longer steer — the second arrow press would go nowhere.
 *
 * Security: the label is a tenant-authored attribute or category name. Nothing
 * here logs it.
 */
import React, { useEffect, useRef } from 'react';
import { IconButton } from '../shared';
import Icon from '../shared/Icon';
import type { AttributeStep } from './profileDisplayOps';

/** Props for {@link ProfileDisplayGrip}. */
export interface ProfileDisplayGripProps {
  /** What this handle moves — an attribute's label or a category's name. */
  label: string;
  /** `true` while this handle's item is lifted; reflected as `aria-pressed`. */
  lifted: boolean;
  /**
   * Turns the handle off. Set while the pane's filter hides rows: a drop into a
   * partly-rendered list would compute a position against rows that are not there.
   */
  disabled?: boolean;
  /** `id` of the element describing the keyboard contract, when one is rendered. */
  describedBy?: string;
  /** Start a pointer drag. Nothing lifts until the pointer travels 4px. */
  onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => void;
  /** Lift this item with the keyboard. */
  onLift: () => void;
  /** Move the lifted item one step. */
  onStep: (direction: AttributeStep) => void;
  /** Drop the lifted item where it stands. */
  onDrop: () => void;
  /** Abandon the lift and put the item back. */
  onCancel: () => void;
}

/** Arrow key to the step it takes. */
const STEP_KEYS: Readonly<Record<string, AttributeStep>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'prev-section',
  ArrowRight: 'next-section',
};

/**
 * A drag handle that also reorders from the keyboard.
 *
 * @example
 * ```tsx
 * <ProfileDisplayGrip
 *   label={attribute.label}
 *   lifted={editor.drag?.id === attribute.name}
 *   onPointerDown={(event) => editor.beginDrag('attr', attribute.name, event)}
 *   onLift={() => editor.lift('attr', attribute.name)}
 *   onStep={editor.step}
 *   onDrop={editor.drop}
 *   onCancel={editor.cancelDrag}
 * />
 * ```
 */
const ProfileDisplayGrip: React.FC<ProfileDisplayGripProps> = ({
  label,
  lifted,
  disabled = false,
  describedBy,
  onPointerDown,
  onLift,
  onStep,
  onDrop,
  onCancel,
}) => {
  const buttonRef = useRef<HTMLButtonElement>(null);

  // No dependency array: a keyboard move re-renders (and often remounts) this
  // handle, and the lift has to keep its steering wheel.
  useEffect(() => {
    if (lifted) buttonRef.current?.focus();
  });

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>): void => {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      if (lifted) onDrop();
      else onLift();
      return;
    }
    if (!lifted) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
      return;
    }
    const step = STEP_KEYS[event.key];
    if (!step) return;
    event.preventDefault();
    onStep(step);
  };

  return (
    <IconButton
      size="sm"
      variant="subtle"
      label={`Reorder ${label}`}
      title={disabled ? 'Clear the filter to reorder' : `Reorder ${label}`}
      active={lifted}
      disabled={disabled}
      describedBy={describedBy}
      buttonRef={buttonRef}
      onPointerDown={disabled ? undefined : onPointerDown}
      onKeyDown={handleKeyDown}
      className="cursor-grab touch-none"
    >
      <Icon type="grip" size="sm" />
    </IconButton>
  );
};

export default ProfileDisplayGrip;
