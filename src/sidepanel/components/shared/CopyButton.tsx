/**
 * @module sidepanel/components/shared/CopyButton
 * @description Copy-to-clipboard button that briefly confirms success by swapping its icon + label.
 *
 * Wraps the shared {@link Button}. Text is produced lazily via `getText()` on
 * click, and clipboard failures (blocked permissions / insecure context) fail
 * silently rather than throwing.
 */
import React, { useState } from 'react';
import Button, { type ButtonVariant, type ButtonSize } from './Button';

interface CopyButtonProps {
  /** Text to copy, computed lazily on click so large lists aren't built until needed. */
  getText: () => string;
  /** Idle label, e.g. "Copy all". */
  label: string;
  /** Label shown briefly after a successful copy. */
  copiedLabel?: string;
  disabled?: boolean;
  title?: string;
  /** Idle-state button variant (the confirmed state always uses `success`). Defaults to `secondary`. */
  variant?: ButtonVariant;
  /** Button size passed through to {@link Button}. Defaults to `sm`. */
  size?: ButtonSize;
  className?: string;
}

/**
 * A copy-to-clipboard button that briefly confirms the copy by swapping its icon
 * and label (to `success` styling) for ~1.5s. Wraps the shared {@link Button}.
 *
 * @example
 * ```tsx
 * <CopyButton label="Copy emails" getText={() => users.map((u) => u.email).join('\n')} />
 * ```
 */
const CopyButton: React.FC<CopyButtonProps> = ({
  getText,
  label,
  copiedLabel = 'Copied',
  disabled = false,
  title,
  variant = 'secondary',
  size = 'sm',
  className,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const text = getText();
    navigator.clipboard.writeText(text).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => {
        // Clipboard can be blocked (permissions / insecure context); fail quietly.
      },
    );
  };

  return (
    <Button
      variant={copied ? 'success' : variant}
      size={size}
      icon={copied ? 'clipboard-check' : 'clipboard'}
      onClick={handleCopy}
      disabled={disabled}
      title={title}
      className={className}
    >
      {copied ? copiedLabel : label}
    </Button>
  );
};

export default CopyButton;
