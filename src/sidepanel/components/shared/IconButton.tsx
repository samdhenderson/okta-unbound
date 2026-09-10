/**
 * @module sidepanel/components/shared/IconButton
 * @description Icon-only button primitive (close, remove, clear, expand) — requires an accessible `label`.
 *
 * Three low-emphasis variants and two sizes. Can act as a toggle via `active`
 * (reflected as `aria-pressed`) or as a disclosure trigger via `expanded` +
 * `controls` (`aria-expanded` + `aria-controls`). For text CTAs use `Button`; for
 * filter chips use `FilterPill`.
 *
 * Carries the shared `.press` class (response motion, ADR-0046) plus
 * `active:brightness-90` for a third, darker background step beyond hover — see
 * `Button`'s module docs for why a filter stands in for a colour token here.
 */
import React from 'react';

/** Low-emphasis treatments: `ghost` and `subtle` differ in hover intensity; `danger` hovers red. */
export type IconButtonVariant = 'ghost' | 'subtle' | 'danger';
/** `sm` (p-1) or `md` (p-1.5) padding around the glyph. */
export type IconButtonSize = 'sm' | 'md';

interface IconButtonProps {
  /** Accessible name — required. Also the default tooltip. */
  label: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  /** The icon to render (an `<svg>` or `<Icon />`); it controls its own dimensions. */
  children: React.ReactNode;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  /** Tooltip text; defaults to `label`. */
  title?: string;
  /** For toggle buttons — reflected as `aria-pressed`. */
  active?: boolean;
  /**
   * For disclosure triggers — reflected as `aria-expanded`. Pair with
   * {@link IconButtonProps.controls} so assistive tech can reach the region the
   * button opens.
   */
  expanded?: boolean;
  /** `id` of the region this button shows/hides — reflected as `aria-controls`. */
  controls?: string;
  /**
   * Pointer-down handler, for a button that starts a gesture rather than firing
   * on click — a drag handle. A click still fires `onClick` as usual.
   */
  onPointerDown?: (e: React.PointerEvent<HTMLButtonElement>) => void;
  /**
   * Key handler, for a button that owns a keyboard interaction beyond activation
   * — a drag handle stepping with the arrow keys while it holds focus.
   */
  onKeyDown?: (e: React.KeyboardEvent<HTMLButtonElement>) => void;
  /** Extra accessible description — `id` of the element explaining the control. */
  describedBy?: string;
  /**
   * Ref to the underlying `<button>` — for a control that has to take focus back
   * after the list around it re-renders (a drag handle mid-keyboard-reorder).
   */
  buttonRef?: React.Ref<HTMLButtonElement>;
  className?: string;
}

const variantClasses: Record<IconButtonVariant, string> = {
  ghost: 'text-neutral-400 hover:text-neutral-700 hover:bg-neutral-50',
  subtle: 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100',
  danger: 'text-neutral-400 hover:text-danger hover:bg-danger-light',
};

const sizeClasses: Record<IconButtonSize, string> = {
  sm: 'p-1',
  md: 'p-1.5',
};

/**
 * Icon-only button primitive for feature components (close, remove, clear, expand).
 * Requires a `label` for accessibility. For chunky text CTAs use `Button`;
 * for filter chips use `FilterPill`.
 *
 * @example
 * ```tsx
 * <IconButton label="Remove" variant="danger" onClick={() => onRemove(item)}>
 *   <Icon type="trash" />
 * </IconButton>
 * ```
 *
 * @example As a disclosure trigger
 * ```tsx
 * <IconButton label={open ? 'Collapse' : 'Expand'} expanded={open} controls={panelId}>
 *   <Icon type="chevron-right" />
 * </IconButton>
 * ```
 */
const IconButton: React.FC<IconButtonProps> = ({
  label,
  onClick,
  children,
  variant = 'ghost',
  size = 'md',
  disabled = false,
  type = 'button',
  title,
  active,
  expanded,
  controls,
  onPointerDown,
  onKeyDown,
  describedBy,
  buttonRef,
  className = '',
}) => (
  <button
    ref={buttonRef}
    type={type}
    onClick={onClick}
    onPointerDown={onPointerDown}
    onKeyDown={onKeyDown}
    disabled={disabled}
    aria-label={label}
    aria-pressed={active}
    aria-expanded={expanded}
    aria-controls={controls}
    aria-describedby={describedBy}
    title={title ?? label}
    className={`inline-flex items-center justify-center rounded-md press active:brightness-90 focus:outline-2 focus:outline-offset-2 focus:outline-primary disabled:opacity-50 disabled:cursor-not-allowed ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
  >
    {children}
  </button>
);

export default IconButton;
