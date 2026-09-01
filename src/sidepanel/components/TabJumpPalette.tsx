/**
 * @module sidepanel/components/TabJumpPalette
 * @description The ⌘K palette: jump to a section, or find anything in the org.
 *
 * The primary nav is an icon rail: inactive tabs are icon-only, which is compact
 * but asks the user to aim at a small target. This palette is the keyboard route
 * to the same destinations — it costs no horizontal space and no clicks. Open it
 * with ⌘K / Ctrl+K (see {@link module:sidepanel/hooks/useCommandPalette}, which
 * owns the one global listener), type a few letters, press Enter.
 *
 * It searches two things at once, and they are not the same kind of thing:
 *
 * - **Sections** — the nine entries in {@link module:sidepanel/tabs}. A fixed,
 *   tiny, local list, so it filters on every keystroke and never costs anything.
 * - **Entities** — groups, apps, rules, policies and users in the connected org.
 *   Debounced and paid for, driven by
 *   {@link module:sidepanel/hooks/useJumpResolver} through this component's
 *   optional entity props. A section jump must not get slower because the org is
 *   also being searched, which is why only one of the two halves waits.
 *
 * This component is **presentational**: it renders what it is handed and owns no
 * data. {@link module:sidepanel/components/CommandPalette} owns the hooks. That
 * split is what keeps the palette's stories and unit tests free of API mocking,
 * and it is why every entity prop here is optional — with none of them supplied
 * this is exactly the sections-only palette it has always been.
 *
 * ## One flat list, rendered as sections
 *
 * Section headings are a render-time partition over **one** `flatRows` array, not
 * a list of lists. The roving-focus model — one anchor, wrapping Up/Down, Enter
 * from the field taking the top row — is index arithmetic over that array, and
 * every one of those behaviours would need re-deriving if the rows were grouped
 * first and flattened after. Build flat, slice to render; never the reverse. The
 * headings themselves are `role="presentation"` so they cannot land in the
 * roving order.
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
import { AlertMessage, EmptyState, Input, LoadingSpinner, Modal } from './shared';
import Icon, { type IconType } from './shared/Icon';
import OpenInOktaLink from './shared/OpenInOktaLink';
import PaletteRow from './palette/PaletteRow';
import { destinationLabel, KIND_ICON } from './home/jumpDestinations';
import { TAB_DEFS, type TabType } from '../tabs';
import type { JumpKind, JumpMode, JumpResult } from '../hooks/useJumpResolver';
import type { OktaAdminEntityType } from '../../shared/utils/oktaUrl';

/**
 * The order entity sections appear in, and the copy above each.
 *
 * Fixed rather than sorted by result count: a list whose sections reorder as you
 * type is unreadable, and the reader's muscle memory for "groups are at the top"
 * is worth more than putting the biggest section first.
 */
const SECTION_ORDER: ReadonlyArray<{ kind: JumpKind; heading: string }> = [
  { kind: 'group', heading: 'Groups' },
  { kind: 'app', heading: 'Apps' },
  { kind: 'rule', heading: 'Rules' },
  { kind: 'policy', heading: 'Policies' },
  { kind: 'user', heading: 'Users' },
];

/**
 * Okta admin-console link targets, for the kinds `oktaUrl` can address.
 *
 * Mirrors `home/JumpResultRow`'s table for the same reason: an unreachable kind
 * renders a working link rather than a control that only refuses (ADR-0039).
 * `rule` and `policy` are absent because the admin console has no single-entity
 * route for either.
 */
const OKTA_LINK_TYPE: Partial<Record<JumpKind, OktaAdminEntityType>> = {
  group: 'group',
  user: 'user',
  app: 'app',
};

/**
 * Where a section's rows came from, so the palette can say it in one word.
 *
 * Users are structurally absent from the local org snapshot (ADR-0040 §5) and a
 * collection whose walk never finished cannot be read as the whole org
 * (ADR-0040 §7). Both facts belong next to the rows they describe rather than in
 * a footnote nobody reads.
 */
export interface SectionMeta {
  /** `true` when this kind's rows came from the local snapshot at zero cost. */
  fromSnapshot: boolean;
  /** `false` when the snapshot walk backing it has not finished. */
  complete: boolean;
}

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
  /**
   * Push the query out to the entity resolver. Omit it and the palette is
   * sections-only — which is exactly what it was before entity search landed,
   * and what its own stories and tests render.
   */
  onEntityQueryChange?: (query: string) => void;
  /** What the entity resolver is doing, for the spinner and the status line. */
  entityMode?: JumpMode;
  /** Entity rows to render, already ordered within each kind. */
  entityResults?: JumpResult[];
  /** Entity search failure, rendered as a `danger` banner. */
  entityError?: string | null;
  /** Open one entity result. The palette closes itself afterwards. */
  onEntitySelect?: (result: JumpResult) => void;
  /**
   * Whether this build can open a given kind in-panel. An unreachable kind
   * renders an "Open in Okta" link instead of a dead control (ADR-0039).
   */
  canReach?: (kind: JumpKind) => boolean;
  /** Per-kind provenance, for the section headings. See {@link SectionMeta}. */
  sectionMeta?: Partial<Record<JumpKind, SectionMeta>>;
  /** Org origin, for the Okta links an unreachable kind falls back to. */
  oktaOrigin?: string | null;
  /**
   * Shortest query the entity search will act on, so the palette can say what it
   * is waiting for instead of looking broken. Mirrors `JUMP_SEARCH_MIN_CHARS`.
   */
  entityMinChars?: number;
}

/** One section row — a top-level destination from the rail. */
interface SectionRow {
  /** Stable id handed back to {@link TabJumpPaletteProps.onSelect}. */
  id: TabType;
  /** Visible, searchable text. */
  label: string;
  /** Glyph from the shared {@link Icon} registry. */
  icon: IconType;
}

/** What one row in the flat list is, so the keyboard model can stay index-based. */
type FlatRow =
  | { type: 'section'; row: SectionRow }
  | { type: 'entity'; row: JumpResult; heading: string | null };

/**
 * The palette's one-word provenance mark for a section heading.
 *
 * @param meta - What is known about where this kind's rows came from.
 * @returns The mark, or `null` when there is nothing honest to add.
 */
function provenanceMark(meta: SectionMeta | undefined): string | null {
  if (!meta) return null;
  if (!meta.fromSnapshot) return 'live';
  return meta.complete ? 'from snapshot' : 'partial snapshot';
}

/**
 * The ⌘K palette: jump between sections, and search the org.
 *
 * Section filtering is a case-insensitive substring match on the label and
 * happens on every keystroke. Entity results are handed in by the container and
 * arrive on their own schedule. The keyboard model spans both: type to filter,
 * Enter from the field activates the top row of the whole list, Down enters it,
 * Up/Down move within it (Up from the first row returns to the field), Enter or
 * Space activates, Escape closes.
 *
 * @example
 * ```tsx
 * // Sections only — the shape every story and unit test renders.
 * <TabJumpPalette isOpen onClose={close} activeTab={tab} onSelect={jump} />
 * ```
 */
const TabJumpPalette: React.FC<TabJumpPaletteProps> = ({
  isOpen,
  onClose,
  activeTab,
  onSelect,
  onEntityQueryChange,
  entityMode = 'idle',
  entityResults,
  entityError = null,
  onEntitySelect,
  canReach,
  sectionMeta,
  oktaOrigin,
  entityMinChars = 3,
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

  const searchesEntities = onEntityQueryChange !== undefined;
  const isSearching = entityMode === 'searching' || entityMode === 'resolving';

  const sectionRows = useMemo<SectionRow[]>(() => {
    const needle = query.trim().toLowerCase();
    const all = TAB_DEFS.map(({ id, label, icon }) => ({ id, label, icon }));
    if (!needle) return all;
    return all.filter((result) => result.label.toLowerCase().includes(needle));
  }, [query]);

  // Held across a refining search: while the resolver is busy, the rows from the
  // previous settle stay on screen. Without this the list empties mid-word and
  // replays its entrance animation on every settle, which reads as the palette
  // losing its place rather than as it working.
  const showEntities =
    (entityResults?.length ?? 0) > 0 && (entityMode === 'results' || isSearching);

  // ONE flat array. Sections below are slices of it, so `activeIndex`,
  // `rowRefs`, wrapping and Enter-takes-the-top all stay plain index arithmetic.
  const flatRows = useMemo<FlatRow[]>(() => {
    const rows: FlatRow[] = sectionRows.map((row) => ({ type: 'section' as const, row }));
    if (!showEntities || !entityResults) return rows;
    for (const { kind, heading } of SECTION_ORDER) {
      const forKind = entityResults.filter((result) => result.kind === kind);
      forKind.forEach((row, index) => {
        // The heading rides on the first row of its run, so a section boundary
        // is derivable from the flat array rather than tracked beside it.
        rows.push({ type: 'entity', row, heading: index === 0 ? heading : null });
      });
    }
    return rows;
  }, [sectionRows, entityResults, showEntities]);

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

  const handleEntitySelect = useCallback(
    (result: JumpResult) => {
      onEntitySelect?.(result);
      onClose();
    },
    [onEntitySelect, onClose],
  );

  const activateRow = useCallback(
    (entry: FlatRow) => {
      if (entry.type === 'section') handleSelect(entry.row.id);
      else handleEntitySelect(entry.row);
    },
    [handleSelect, handleEntitySelect],
  );

  /** Move roving focus to `index`, wrapping at both ends. No-op with no results. */
  const focusRow = useCallback(
    (index: number) => {
      const count = flatRows.length;
      if (count === 0) return;
      const next = ((index % count) + count) % count;
      setActiveIndex(next);
      rowRefs.current[next]?.focus();
    },
    [flatRows.length],
  );

  const handleQueryChange = useCallback(
    (value: string) => {
      setQuery(value);
      // The old anchor may not exist in the new result set; the top row always does.
      setActiveIndex(0);
      // The two halves diverge here on purpose: sections re-filter synchronously
      // above, while the org search debounces behind this call. A section jump
      // must not get slower because an org search is also in flight.
      onEntityQueryChange?.(value);
    },
    [onEntityQueryChange],
  );

  const handleFieldKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusRow(0);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusRow(flatRows.length - 1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const top = flatRows[0];
      if (top) activateRow(top);
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

  const entityCount = showEntities ? flatRows.length - sectionRows.length : 0;
  const trimmedLength = query.trim().length;
  const belowFloor = searchesEntities && trimmedLength > 0 && trimmedLength < entityMinChars;
  const foundNothing =
    searchesEntities && entityMode === 'results' && entityCount === 0 && !entityError;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Jump to section" size="md">
      <Input
        type="search"
        value={query}
        onChange={handleQueryChange}
        onKeyDown={handleFieldKeyDown}
        inputRef={inputRef}
        ariaLabel="Search sections"
        placeholder={
          searchesEntities ? 'Search sections, groups, apps, users…' : 'Search sections…'
        }
        icon={<Icon type="search" size="sm" />}
        trailing={isSearching ? <LoadingSpinner size="sm" /> : undefined}
      />

      {/* Roving focus gives no implicit result announcement the way a combobox
          would, so the count is announced explicitly as the query narrows.
          Append-only by design: the sections clause is byte-identical to what it
          has always been, so the sections-only palette announces exactly what it
          always announced. */}
      <p role="status" className="sr-only">
        {sectionRows.length} {sectionRows.length === 1 ? 'section' : 'sections'} available
        {entityCount > 0 && `, ${entityCount} ${entityCount === 1 ? 'result' : 'results'}`}
        {isSearching && ', searching'}
        {entityError && ', search failed'}
      </p>

      {entityError && (
        <div className="mt-3">
          <AlertMessage message={{ text: entityError, type: 'danger' }} />
        </div>
      )}

      {flatRows.length === 0 ? (
        <EmptyState
          icon="search"
          title="No sections match"
          description="No top-level section has that name. Try a shorter search."
        />
      ) : (
        // `.rise-in-stagger` steps its direct children 24ms apart, capped at the
        // 8th by pure CSS `:nth-child` — no index prop reaches a row.
        <ul className="mt-3 rise-in-stagger">
          {flatRows.map((entry, index) => {
            const rowRef = (element: HTMLElement | null) => {
              rowRefs.current[index] = element;
            };
            const tabIndex = index === activeIndex ? 0 : -1;

            if (entry.type === 'section') {
              const isCurrent = entry.row.id === activeTab;
              return (
                <li key={`section:${entry.row.id}`}>
                  <PaletteRow
                    icon={entry.row.icon}
                    label={entry.row.label}
                    isCurrent={isCurrent}
                    trailing={isCurrent ? 'Current' : undefined}
                    tabIndex={tabIndex}
                    rowRef={rowRef}
                    onClick={() => handleSelect(entry.row.id)}
                    onKeyDown={(event) => handleRowKeyDown(event, index)}
                  />
                </li>
              );
            }

            const { row, heading } = entry;
            const reachable = canReach?.(row.kind) ?? false;
            const linkType = OKTA_LINK_TYPE[row.kind];
            const mark = reachable ? (
              `${destinationLabel(row.kind)} ›`
            ) : linkType ? (
              <OpenInOktaLink
                oktaOrigin={oktaOrigin}
                entityType={linkType}
                entityId={row.id}
                size="sm"
              />
            ) : null;
            const provenance = provenanceMark(sectionMeta?.[row.kind]);

            return (
              <React.Fragment key={`entity:${row.kind}:${row.id}`}>
                {heading && (
                  // `role="presentation"` so a heading can never land in the
                  // roving order — the flat array holds rows only.
                  <li
                    role="presentation"
                    className="mt-3 mb-1 px-(--sp-row-x) text-xs font-semibold uppercase tracking-wide text-neutral-500"
                  >
                    {heading}
                    {provenance && (
                      <span className="ml-2 font-normal normal-case">· {provenance}</span>
                    )}
                  </li>
                )}
                <li>
                  <PaletteRow
                    icon={KIND_ICON[row.kind]}
                    label={row.name}
                    secondary={row.secondary}
                    trailing={mark}
                    tabIndex={tabIndex}
                    rowRef={rowRef}
                    onClick={() => handleEntitySelect(row)}
                    onKeyDown={(event) => handleRowKeyDown(event, index)}
                    ariaLabel={
                      reachable ? `${row.name} — open in ${destinationLabel(row.kind)}` : undefined
                    }
                  />
                </li>
              </React.Fragment>
            );
          })}
        </ul>
      )}

      {/* Deliberately a muted line rather than a second `EmptyState`: the
          sections one above is the empty case for the whole panel, and two
          stacked read as a broken dialog. */}
      {belowFloor && (
        <p className="mt-3 text-xs text-neutral-500">
          Type {entityMinChars} characters to search the org.
        </p>
      )}
      {foundNothing && (
        // Never "no users match" — that asserts an absence a 20-row capped
        // search cannot support. Say what actually happened.
        <p className="mt-3 text-xs text-neutral-500">Nothing in the org matched that search.</p>
      )}

      <p className="mt-4 text-xs text-neutral-500">
        <kbd className="font-sans">↑↓</kbd> to browse · <kbd className="font-sans">Enter</kbd> to
        jump · <kbd className="font-sans">Esc</kbd> to close
      </p>
    </Modal>
  );
};

export default TabJumpPalette;
