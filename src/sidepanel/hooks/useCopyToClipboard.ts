/**
 * @module sidepanel/hooks/useCopyToClipboard
 * @description Shared copy-to-clipboard hook with a transient "copied" confirmation.
 *
 * Centralizes the copy-then-confirm pattern used by {@link CopyButton} and the
 * inline id-copy affordances: `copy(text)` writes via the async Clipboard API,
 * flips `copied` on for {@link COPIED_RESET_MS}, and fails quietly when the
 * clipboard is blocked (permissions / insecure context) so callers never see an
 * unhandled rejection. The reset timer is cleared on unmount.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

/** How long the `copied` confirmation stays on after a successful copy. */
const COPIED_RESET_MS = 1500;

/** Return shape of {@link useCopyToClipboard}. */
export interface UseCopyToClipboardResult {
  /** True for ~1.5 s after a successful copy; drives "Copied!" affordances. */
  copied: boolean;
  /** Write `text` to the clipboard; failures are swallowed and leave `copied` false. */
  copy: (text: string) => void;
}

/**
 * Copy text to the clipboard with a self-resetting confirmation flag.
 *
 * @returns `{ copied, copy }` — see {@link UseCopyToClipboardResult}.
 *
 * @example
 * ```tsx
 * const { copied, copy } = useCopyToClipboard();
 * <IconButton label={copied ? 'Copied!' : 'Copy ID'} onClick={() => copy(group.id)} />
 * ```
 */
export function useCopyToClipboard(): UseCopyToClipboardResult {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear any pending reset on unmount so no setState fires on an unmounted tree.
  useEffect(
    () => () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    },
    [],
  );

  const copy = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(
      () => {
        setCopied(true);
        if (timerRef.current !== null) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setCopied(false), COPIED_RESET_MS);
      },
      () => {
        // Clipboard can be blocked (permissions / insecure context); fail quietly.
      },
    );
  }, []);

  return { copied, copy };
}
