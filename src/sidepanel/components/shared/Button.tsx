/**
 * @module sidepanel/components/shared/Button
 * @description The primary text button primitive — the default choice for any clickable CTA.
 *
 * Five variants and four sizes, with optional leading/trailing icon, loading
 * spinner, badge, and full-width layout. For icon-only affordances use
 * `IconButton`; for filter toggles use `FilterPill`.
 *
 * A button that shows and hides a region passes `expanded` + `controls`, exactly
 * as `IconButton` does — a labelled disclosure trigger (the user detail rung's
 * **Manage** tier) is still a disclosure, and hand-rolling a `<button>` to get
 * `aria-expanded` onto it is banned.
 *
 * ## Response motion (ADR-0046)
 *
 * Carries the shared `.press` class — a `scale(.955)` depress on `:active` that
 * resolves inside `--dur-press` (60ms) and releases over `--dur-quick`/`--ease-affirm`
 * — plus `active:brightness-90`, the third, darker background step Odyssey's own
 * button carries beyond hover (`hover → Dark`, `active → Darker`). No variant here
 * has a token for that third step on its own (`primary`/`danger`/`success` already
 * spend their only darker token — `-dark`/`-text` — on `hover`), so the extra step
 * comes from a brightness filter rather than a new colour token.
 */
import React from 'react';
import Icon, { type IconType } from '../shared/Icon';

/** Visual treatments: `secondary` is the default; `danger`/`success` carry semantic colour; `ghost` is chromeless. */
export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
/**
 * Height/padding scale — `xs` ≈ 24px, `sm` ≈ 36px, `md` ≈ 40px, `lg` ≈ 56px.
 *
 * `xs` is the recessed tier: a control that is furniture around a list rather
 * than a verb acting on the page — the selection register's `Select all (M)` and
 * its neighbours (ADR-0051). It is deliberately the only size that reads as
 * *smaller than a button*, so a register full of them cannot out-weigh the
 * page's own verbs sitting on the row above. Do not reach for it to fit more
 * chrome into a tight row; that is what the `ActionBar` overflow tier is for.
 */
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

interface ButtonProps {
  /** Button label content. */
  children: React.ReactNode;
  /** Visual treatment. Defaults to `secondary`. */
  variant?: ButtonVariant;
  /** Size scale. Defaults to `md`. */
  size?: ButtonSize;
  /** Optional icon glyph rendered alongside the label (hidden while `loading`). */
  icon?: IconType;
  /** Which side of the label the icon sits on. Defaults to `left`. */
  iconPosition?: 'left' | 'right';
  disabled?: boolean;
  /** When true, shows a spinner and disables the button (also disabled when `disabled`). */
  loading?: boolean;
  onClick?: () => void;
  /** Native button type. Defaults to `button` (does not submit forms). */
  type?: 'button' | 'submit' | 'reset';
  className?: string;
  /** Stretch to fill the container width. */
  fullWidth?: boolean;
  /** Optional count/badge pill rendered at the trailing edge (e.g. unread count). */
  badge?: string;
  /** Native `title` tooltip. */
  title?: string;
  /**
   * For a labelled disclosure trigger — reflected as `aria-expanded`. Pair with
   * {@link ButtonProps.controls} so assistive tech can reach the region it
   * shows/hides. `IconButton` carries the same pair for icon-only disclosures.
   */
  expanded?: boolean;
  /** `id` of the region this button shows/hides — reflected as `aria-controls`. */
  controls?: string;
  /**
   * Overrides the accessible name when the visible label is not a sentence a
   * screen-reader user could act on.
   *
   * Use it sparingly and never to restate the label. The case it exists for is
   * a button whose visible text is a **noun** — an entity name, a filename —
   * where the verb lives in the surrounding layout rather than in the words:
   * `Payments Team` says nothing about what pressing it does, while
   * `Open Payments Team in Groups` does. A `title` cannot fix that, because a
   * `title` on an element that already has content becomes the accessible
   * *description*, and a description is not a name.
   */
  ariaLabel?: string;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: `
    bg-primary hover:bg-primary-dark
    text-white font-semibold
    disabled:bg-primary-highlight disabled:text-neutral-400
  `,
  secondary: `
    bg-white hover:bg-neutral-50
    text-neutral-900 font-medium
    border border-neutral-200 hover:border-neutral-500
    disabled:bg-neutral-50 disabled:text-neutral-400 disabled:border-neutral-200
  `,
  danger: `
    bg-danger hover:bg-danger-text
    text-white font-semibold
    disabled:bg-danger-light disabled:text-neutral-400
  `,
  success: `
    bg-success hover:bg-success-text
    text-white font-semibold
    disabled:bg-success-light disabled:text-neutral-400
  `,
  ghost: `
    bg-transparent hover:bg-neutral-50
    text-neutral-700 font-medium
    disabled:text-neutral-400
  `,
};

const sizeClasses: Record<ButtonSize, string> = {
  xs: 'px-2 py-0.5 text-xs min-h-6', // 24px
  sm: 'px-3 py-1.5 text-xs min-h-9', // 36px
  md: 'px-4 py-2 text-sm min-h-10', // 40px
  lg: 'px-4 py-3 text-base min-h-14', // 56px
};

/**
 * The shared text button. Prefer this over a hand-rolled `<button>`.
 *
 * @example
 * ```tsx
 * <Button variant="primary" icon="plus" onClick={handleAdd}>
 *   Add group
 * </Button>
 * ```
 */
/**
 * The glyph size that rides with each button size: 12px inside the 24px `xs`
 * chip, 16px inside `sm`, 20px above that.
 */
const iconSize = (size: ButtonSize): 'xs' | 'sm' | 'md' =>
  size === 'xs' ? 'xs' : size === 'sm' ? 'sm' : 'md';

const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'secondary',
  size = 'md',
  icon,
  iconPosition = 'left',
  disabled = false,
  loading = false,
  onClick,
  type = 'button',
  className = '',
  fullWidth = false,
  badge,
  title,
  expanded,
  controls,
  ariaLabel,
}) => {
  const baseClasses = `
    inline-flex items-center justify-center gap-2
    rounded-md press active:brightness-90
    disabled:cursor-not-allowed
    focus:outline-2 focus:outline-offset-2 focus:outline-primary
    ${variantClasses[variant]}
    ${sizeClasses[size]}
    ${fullWidth ? 'w-full' : ''}
  `
    .trim()
    .replace(/\s+/g, ' ');

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseClasses} ${className}`}
      title={title}
      aria-label={ariaLabel}
      aria-expanded={expanded}
      aria-controls={controls}
      style={{ fontFamily: 'var(--font-heading)' }}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {!loading && icon && iconPosition === 'left' && <Icon type={icon} size={iconSize(size)} />}
      <span>{children}</span>
      {!loading && icon && iconPosition === 'right' && <Icon type={icon} size={iconSize(size)} />}
      {badge && (
        <span className="ml-1 px-2 py-0.5 rounded-full text-xs font-bold bg-danger text-white">
          {badge}
        </span>
      )}
    </button>
  );
};

export default Button;
