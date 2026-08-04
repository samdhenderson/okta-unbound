/**
 * @module sidepanel/hooks/useCommandPalette
 * @description Owns the side panel's single global ⌘K / Ctrl+K shortcut.
 *
 * The panel keeps **every tab mounted** (ADR-0018), so a `window` listener
 * registered inside a tab component would be registered once per mounted tab and
 * fire N times for one keypress. This hook therefore exists to be called **once,
 * by the shell** (`App`) — it is the single owner of the shortcut, and the open
 * state it returns is the shell's to pass down.
 *
 * The handler calls `preventDefault()` so Chrome's own ⌘K/Ctrl+K (the omnibox
 * search shortcut, and the find-bar on some platforms) does not swallow it, and
 * ignores auto-repeat so holding the chord does not strobe the palette open and
 * shut.
 */
import { useCallback, useEffect, useState } from 'react';

/** Open/close state for the ⌘K palette, plus the imperative controls the shell needs. */
export interface CommandPaletteControls {
  /** Whether the palette is currently requested open. */
  isOpen: boolean;
  /** Open the palette (e.g. from a toolbar affordance). */
  open: () => void;
  /** Close the palette — passed to the palette's `onClose`. */
  close: () => void;
}

/**
 * Register the app-wide ⌘K / Ctrl+K shortcut and track whether the jump-to
 * palette is open.
 *
 * Call this exactly once, from the app shell. The chord toggles: pressing it
 * again while the palette is open closes it, matching every other command
 * palette users already know.
 *
 * @returns The palette's {@link CommandPaletteControls}.
 *
 * @example
 * ```tsx
 * const palette = useCommandPalette();
 * return <TabJumpPalette isOpen={palette.isOpen} onClose={palette.close} … />;
 * ```
 */
export function useCommandPalette(): CommandPaletteControls {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // `globalThis.`-qualified because eslint's `no-undef` runs off the explicit
    // DOM globals allow-list in `eslint.config.js`, which has no `KeyboardEvent`.
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      // Alt+⌘K / Ctrl+Alt+K belong to other things; only the bare chord counts.
      if (event.altKey || !(event.metaKey || event.ctrlKey)) return;
      if (event.key !== 'k' && event.key !== 'K') return;
      // Holding the chord down would otherwise toggle once per repeat.
      if (event.repeat) return;
      event.preventDefault();
      setIsOpen((prev) => !prev);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  return { isOpen, open, close };
}
