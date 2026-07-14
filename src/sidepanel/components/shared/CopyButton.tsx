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
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}

/**
 * A copy-to-clipboard button that briefly confirms the copy by swapping its icon
 * and label. Wraps the shared {@link Button} so it inherits the app's button styles.
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
