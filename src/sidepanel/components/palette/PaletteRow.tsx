/**
 * @module sidepanel/components/palette/PaletteRow
 * @description One row in the ⌘K palette's result list — a section to jump to,
 * or an entity to open.
 *
 * ## §3 exception — a raw `<button>`
 *
 * A palette row is a left-aligned icon + label + trailing-mark row carrying a
 * roving `tabIndex` and a ref for programmatic focus. Neither shared primitive
 * can host that today, and the gap is structural rather than stylistic, so a new
 * variant would not discharge it:
 *
 * - **`Button`** is a centred CTA and exposes neither `tabIndex` nor a ref.
 * - **`ListRow`** exposes `elementRef`, which is half of what is needed, but no
 *   `tabIndex` and no `onKeyDown` — so it cannot carry the roving anchor or the
 *   Up/Down handler either.
 *
 * See `docs/components.md` §3.
 *
 * ## Button or link, never both
 *
 * A row whose kind this build cannot open in-panel has one route left: the Okta
 * admin console. That route is a **link**, and a link inside a button is a
 * `nested-interactive` axe violation — the row's own story caught it. So the row
 * renders as an `<a>` when it is given an `href`, and as a `<button>` otherwise.
 * `home/JumpResultRow` solves the same problem the same way (`as={onSelect ?
 * 'button' : 'div'}`): one interactive element per row, chosen by what the row
 * can actually do.
 *
 * Both forms are focusable and carry the same roving `tabIndex`, so the list's
 * Up/Down arithmetic stays a plain walk over its rows — no skipping, no second
 * index space.
 *
 * `press-subtle` (ADR-0046), not `press`: the row spans the full palette width,
 * so a button-scale depress would read as a lurch. Padding and the icon/label gap
 * consume the `--sp-row-x`/`--sp-row-y`/`--sp-inline` roles (ADR-0048).
 */
import React from 'react';
import Icon, { type IconType } from '../shared/Icon';

/** Props for {@link PaletteRow}. */
export interface PaletteRowProps {
  /** Glyph from the shared {@link Icon} registry. */
  icon: IconType;
  /** Primary line — the section name, or the entity's name. */
  label: string;
  /** Optional second line: a description, a status, a login. */
  secondary?: string;
  /**
   * Right-edge mark. The palette uses it to name where a row goes
   * (`Groups ›`), or to carry an "Open in Okta" link when a kind is
   * unreachable — so a row that cannot navigate still has a route.
   */
  trailing?: React.ReactNode;
  /**
   * Whether this row is the section the reader is already on. Marks the row
   * `aria-current="page"` and tints it, so the palette says where you are rather
   * than only where you could go.
   */
  isCurrent?: boolean;
  /**
   * The roving anchor: exactly one row in the list carries `0`, every other
   * carries `-1`, so the whole list is one tab stop.
   */
  tabIndex: number;
  /**
   * Focus target for the list's Up/Down handling. Typed `HTMLElement` (not
   * `HTMLButtonElement`) only because eslint's `no-undef` runs off the explicit
   * DOM globals allow-list in `eslint.config.js`; all the caller does is
   * `.focus()`, which `HTMLElement` already has.
   */
  rowRef?: (element: HTMLElement | null) => void;
  /**
   * Open this row in the Okta admin console instead of in-panel. Setting it
   * makes the row an `<a>` rather than a `<button>` — see the module note. The
   * caller has already validated the origin (`oktaAdminEntityUrl`).
   */
  href?: string;
  /** Activate this row. Ignored, and unnecessary, when {@link PaletteRowProps.href} is set. */
  onClick?: () => void;
  /** Arrow-key handling, owned by the list so it can see its neighbours. */
  onKeyDown?: (event: React.KeyboardEvent<HTMLElement>) => void;
  /**
   * Accessible name, when the visible label alone is ambiguous — an entity row
   * says where it goes, because "Engineering" on its own does not.
   */
  ariaLabel?: string;
}

/**
 * Render one palette row.
 *
 * @param props - See {@link PaletteRowProps}.
 *
 * @example
 * ```tsx
 * <PaletteRow
 *   icon="users"
 *   label="Engineering"
 *   secondary="All engineers"
 *   trailing={<span>Groups ›</span>}
 *   tabIndex={index === activeIndex ? 0 : -1}
 *   rowRef={(el) => { rowRefs.current[index] = el; }}
 *   onClick={() => open(result)}
 *   onKeyDown={(event) => handleRowKeyDown(event, index)}
 * />
 * ```
 */
const PaletteRow: React.FC<PaletteRowProps> = ({
  icon,
  label,
  secondary,
  trailing,
  isCurrent = false,
  tabIndex,
  rowRef,
  href,
  onClick,
  onKeyDown,
  ariaLabel,
}) => {
  const className = `press press-subtle w-full flex items-center gap-(--sp-inline) px-(--sp-row-x) py-(--sp-row-y) rounded-md text-left text-sm
      transition-colors duration-(--dur-instant)
      focus:outline-2 focus:outline-offset-2 focus:outline-primary
      ${isCurrent ? 'bg-primary-light text-primary-text font-semibold' : 'text-neutral-900 hover:bg-neutral-50'}`;

  const body = (
    <>
      <Icon
        type={icon}
        size="sm"
        className={`shrink-0 ${isCurrent ? 'text-primary-text' : 'text-neutral-500'}`}
      />
      <span className="flex-1 min-w-0">
        <span className="block truncate">{label}</span>
        {secondary && <span className="block truncate text-xs text-neutral-600">{secondary}</span>}
      </span>
      {trailing && <span className="shrink-0 text-xs font-medium">{trailing}</span>}
    </>
  );

  const shared = {
    ref: rowRef,
    tabIndex,
    'aria-current': isCurrent ? ('page' as const) : undefined,
    'aria-label': ariaLabel,
    onKeyDown,
    className,
  };

  return href ? (
    <a {...shared} href={href} target="_blank" rel="noopener noreferrer">
      {body}
    </a>
  ) : (
    <button {...shared} type="button" onClick={onClick}>
      {body}
    </button>
  );
};

export default PaletteRow;
