/**
 * @module sidepanel/components/shared/WorkingSetPinButton
 * @description The pin that keeps an entity on the Home tab.
 *
 * Icon only, in the bottom-right corner of {@link PageHeader}. It carries no
 * visible label on purpose: the header's job is to describe the entity, and a
 * worded button competing with the title would make a small, optional
 * convenience look like the page's main verb.
 *
 * ## The other pin
 *
 * `ContextBar` already has a control called **Pin**, and it means something
 * else — freeze the panel on the detected Okta page. Two identically-worded
 * controls in one panel would be a real confusion, so this one never says the
 * word on screen, and its accessible name says where the thing goes rather than
 * what happens to it: *Pin to Home*, not *Pin*.
 *
 * A toggle, so it reports `aria-pressed` rather than swapping between two
 * buttons — a screen-reader user hears the state, not a relabelled control.
 */
import React from 'react';
import Icon from './Icon';
import IconButton from './IconButton';

/** Props for {@link WorkingSetPinButton}. */
export interface WorkingSetPinButtonProps {
  /** Whether the entity is currently on Home. */
  pinned: boolean;
  /** Toggle it. */
  onToggle: () => void;
  /**
   * Disable while the entity is still resolving. A pin recorded before the name
   * arrives would put a row on Home reading a raw id.
   */
  disabled?: boolean;
}

/**
 * Render the working-set pin toggle.
 *
 * @param props - See {@link WorkingSetPinButtonProps}.
 */
const WorkingSetPinButton: React.FC<WorkingSetPinButtonProps> = ({
  pinned,
  onToggle,
  disabled = false,
}) => (
  <IconButton
    label={pinned ? 'Unpin from Home' : 'Pin to Home'}
    title={pinned ? 'Remove from the Home tab' : 'Keep this on the Home tab'}
    onClick={onToggle}
    active={pinned}
    disabled={disabled}
    variant={pinned ? 'subtle' : 'ghost'}
    size="sm"
  >
    <Icon type="pin" size="sm" />
  </IconButton>
);

export default WorkingSetPinButton;
