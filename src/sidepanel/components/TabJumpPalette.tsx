/**
 * @module sidepanel/components/TabJumpPalette
 * @description ⌘K jump-to palette for the panel's nine top-level sections.
 *
 * The primary nav is an icon rail: inactive tabs are icon-only, which is compact
 * but asks the user to aim at a small target. This palette is the keyboard route
 * to the same destinations — it costs no horizontal space and no clicks. Open it
 * with ⌘K / Ctrl+K (see {@link module:sidepanel/hooks/useCommandPalette}, which
 * owns the one global listener), type a few letters, press Enter.
 *
 * Scope is deliberately **navigation destinations only** — the entries in
 * {@link module:sidepanel/tabs}. Searching groups/users/rules from here is a
 * later feature; the result list is shaped as a generic `{ id, label, icon }`
 * row so that lands as extra sections rather than a rewrite.
 *
 * ## Why roving focus and not a combobox
 *
 * The textbook shape for this is `role="combobox"` +
 * `aria-expanded`/`aria-controls`/`aria-activedescendant` on the input, with
 * focus never leaving the text field. The shared {@link Input} deliberately does
 * not spread arbitrary props, and bending a shared primitive with four ARIA
 * props for one consumer is the wrong trade. Roving focus — Down out of the
 * input, Up/Down between results, Enter to activate — reaches the same place
 * with real focus on a real `<button>`, is axe-clean, and needs no change to
 * `Input`. Revisit if a second consumer ever wants the combobox shape.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EmptyState, Input, Modal } from './shared';
import Icon, { type IconType } from './shared/Icon';
import { TAB_DEFS, type TabType } from '../tabs';

/** Props for {@link TabJumpPalette}. */
interface TabJumpPaletteProps {
  /**
   * When false the palette closes. The underlying {@link Modal} holds the panel
   * in the DOM for one exit animation, hidden from the accessible tree.
   */
  isOpen: boolean;
  /**
   * Invoked on Escape, overlay click, the header close button, and after a
   * result is chosen. Typically `useCommandPalette().close`.
   */
  onClose: () => void;
  /**
   * The section currently on screen. Marked `aria-current="page"` and labelled
   * "Current" in the list, so the palette tells you where you already are.
   */
  activeTab: TabType;
  /**
   * Called with the chosen section id. This must be the same handler the icon
   * rail uses, so a jump and a click are indistinguishable to the rest of the
   * app (persistence, mount-on-first-activation, deep links).
   */
  onSelect: (tab: TabType) => void;
}

/** One row in the palette's result list. Shaped to outlive the tabs-only scope. */
interface JumpResult {
  /** Stable id handed back to {@link TabJumpPaletteProps.onSelect}. */
  id: TabType;
  /** Visible, searchable text. */
  label: string;
  /** Glyph from the shared {@link Icon} registry. */
  icon: IconType;
}

/**
 * Command palette for jumping between the panel's top-level sections.
 *
 * Filtering is a case-insensitive substring match on the section label. The
 * keyboard model is: type to filter, Enter from the field jumps to the top
 * result, Down enters the list, Up/Down move within it (Up from the first row
 * returns to the field), Enter or Space activates, Escape closes.
 *
 * @example
 * ```tsx
 * const palette = useCommandPalette();
 * <TabJumpPalette
 *   isOpen={palette.isOpen}
 *   onClose={palette.close}
 *   activeTab={activeTab}
 *   onSelect={handleTabChange}
 * />
 * ```
 */
const TabJumpPalette: React.FC<TabJumpPaletteProps> = ({
  isOpen,
  onClose,
  activeTab,
  onSelect,
}) => {
  const [query, setQuery] = useState('');
  // Roving tabindex anchor: exactly one row is in the tab order at a time.
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  // Typed as `HTMLElement` (not `HTMLButtonElement`) only because eslint's
  // `no-undef` runs off the explicit DOM globals allow-list in `eslint.config.js`.
  // All this ref does is `.focus()`, which `HTMLElement` already has.
  const rowRefs = useRef<Array<HTMLElement | null>>([]);
  const [prevOpen, setPrevOpen] = useState(isOpen);

  const results = useMemo<JumpResult[]>(() => {
    const needle = query.trim().toLowerCase();
    const all = TAB_DEFS.map(({ id, label, icon }) => ({ id, label, icon }));
    if (!needle) return all;
    return all.filter((result) => result.label.toLowerCase().includes(needle));
  }, [query]);

  // Every open starts from a clean palette. Adjusted during render (React's
  // "adjusting state when a prop changes" pattern, the same shape `Modal` uses
  // for its own mount-hold) rather than in an effect, so the first committed
  // frame of a re-opened palette already shows the unfiltered list — never the
  // previous session's query for one frame.
  if (prevOpen !== isOpen) {
    setPrevOpen(isOpen);
    if (isOpen) {
      setQuery('');
      setActiveIndex(0);
    }
  }

  // Put the caret in the search field on open — deferred by a tick, on purpose.
  // `Modal` focuses the first focusable node in its panel, which is its own
  // header close button, from a passive effect; a child's effects (and React's
  // `autoFocus`) all run *before* its parent's, so focusing synchronously here,
  // or passing `autoFocus` to `Input`, loses that race —
  // `TabJumpPalette.test.tsx` pins exactly that outcome as CHARACTERIZED.
  // A ⌘K palette that lands focus on "Close" instead of the search field is
  // useless, so this one wins the race by yielding first.
  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  const handleSelect = useCallback(
    (tab: TabType) => {
      onSelect(tab);
      onClose();
    },
    [onSelect, onClose],
  );

  /** Move roving focus to `index`, wrapping at both ends. No-op with no results. */
  const focusRow = useCallback(
    (index: number) => {
      const count = results.length;
      if (count === 0) return;
      const next = ((index % count) + count) % count;
      setActiveIndex(next);
      rowRefs.current[next]?.focus();
    },
    [results.length],
  );

  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);
    // The old anchor may not exist in the new result set; the top row always does.
    setActiveIndex(0);
  }, []);

  const handleFieldKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusRow(0);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusRow(results.length - 1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const top = results[0];
      if (top) handleSelect(top.id);
    }
  };

  const handleRowKeyDown = (event: React.KeyboardEvent<HTMLElement>, index: number) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusRow(index + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      // Up off the top of the list returns to the field, so the query is always
      // one key away — the roving model's replacement for a combobox's
      // never-leaves-the-input focus.
      if (index === 0) {
        setActiveIndex(0);
        inputRef.current?.focus();
      } else {
        focusRow(index - 1);
      }
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Jump to section" size="md">
      <Input
        type="search"
        value={query}
        onChange={handleQueryChange}
        onKeyDown={handleFieldKeyDown}
        inputRef={inputRef}
        ariaLabel="Search sections"
        placeholder="Search sections…"
        icon={<Icon type="search" size="sm" />}
      />

      {/* Roving focus gives no implicit result announcement the way a combobox
          would, so the count is announced explicitly as the query narrows. */}
      <p role="status" className="sr-only">
        {results.length} {results.length === 1 ? 'section' : 'sections'} available
      </p>

      {results.length === 0 ? (
        <EmptyState
          icon="search"
          title="No sections match"
          description="No top-level section has that name. Try a shorter search."
        />
      ) : (
        // `.rise-in-stagger` steps its direct children 24ms apart, capped at the
        // 8th by pure CSS `:nth-child` — no index prop reaches a row.
        <ul className="mt-3 rise-in-stagger">
          {results.map((result, index) => {
            const isCurrent = result.id === activeTab;
            return (
              <li key={result.id}>
                {/*
                  §3 exception — raw <button>. A palette row is a left-aligned
                  icon + label + status row with a roving `tabIndex` and a ref for
                  programmatic focus. Shared `Button` is a centred CTA and exposes
                  neither `tabIndex` nor a ref, and the difference is structural
                  rather than stylistic, so a variant would not discharge it. See
                  docs/components.md.

                  `press-subtle` (ADR-0046), not `press`: the row spans the full
                  palette width, so a button-scale depress would read as a lurch.
                  Padding and the icon/label gap consume the `--sp-row-x`/
                  `--sp-row-y`/`--sp-inline` roles (ADR-0048).
                */}
                <button
                  type="button"
                  ref={(el) => {
                    rowRefs.current[index] = el;
                  }}
                  tabIndex={index === activeIndex ? 0 : -1}
                  aria-current={isCurrent ? 'page' : undefined}
                  onClick={() => handleSelect(result.id)}
                  onKeyDown={(event) => handleRowKeyDown(event, index)}
                  className={`press press-subtle w-full flex items-center gap-(--sp-inline) px-(--sp-row-x) py-(--sp-row-y) rounded-md text-left text-sm
                    transition-colors duration-(--dur-instant)
                    focus:outline-2 focus:outline-offset-2 focus:outline-primary
                    ${
                      isCurrent
                        ? 'bg-primary-light text-primary-text font-semibold'
                        : 'text-neutral-900 hover:bg-neutral-50'
                    }`}
                >
                  <Icon
                    type={result.icon}
                    size="sm"
                    className={isCurrent ? 'text-primary-text' : 'text-neutral-500'}
                  />
                  <span className="flex-1">{result.label}</span>
                  {isCurrent && <span className="text-xs font-medium">Current</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-4 text-xs text-neutral-500">
        <kbd className="font-sans">↑↓</kbd> to browse · <kbd className="font-sans">Enter</kbd> to
        jump · <kbd className="font-sans">Esc</kbd> to close
      </p>
    </Modal>
  );
};

export default TabJumpPalette;
