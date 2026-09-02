/**
 * @module sidepanel/components/shared/CopyIconButton
 * @description The ghost copy-to-clipboard icon button shared by {@link CopyableId}
 * and {@link EntityLink}'s `copyId` control.
 *
 * `IconButton` + `Icon` (`clipboard`/`clipboard-check`) + `useCopyToClipboard` +
 * an accessible-name flip to "Copied!" for ~1.5s — the ghost copy-id recipe,
 * extracted once (D-015) after `EntityLink`'s `copyId` control re-implemented
 * it byte-for-byte alongside `CopyableId`.
 */
import React from 'react';
import IconButton from './IconButton';
import Icon from '../shared/Icon';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';

/** Props for {@link CopyIconButton}. */
export interface CopyIconButtonProps {
  /** The raw value copied to the clipboard on click. */
  value: string;
  /**
   * Accessible name in the resting state. Flips to `"Copied!"` for ~1.5s after
   * a click, then reverts.
   */
  label: string;
  /** Extra classes merged onto the button. Defaults to `shrink-0`. */
  className?: string;
}

/**
 * A ghost icon button that copies `value` to the clipboard, confirming with a
 * checkmark glyph and a `"Copied!"` accessible name for ~1.5s.
 */
const CopyIconButton: React.FC<CopyIconButtonProps> = ({
  value,
  label,
  className = 'shrink-0',
}) => {
  const { copied, copy } = useCopyToClipboard();

  return (
    <IconButton
      label={copied ? 'Copied!' : label}
      onClick={() => copy(value)}
      variant="ghost"
      size="sm"
      className={className}
    >
      <Icon
        type={copied ? 'clipboard-check' : 'clipboard'}
        size="sm"
        className={copied ? 'text-success-text' : ''}
      />
    </IconButton>
  );
};

export default CopyIconButton;
