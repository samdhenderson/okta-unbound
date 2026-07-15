/**
 * @module sidepanel/components/shared/Button
 * @description The primary text button primitive — the default choice for any clickable CTA.
 *
 * Five variants and three sizes, with optional leading/trailing icon, loading
 * spinner, badge, and full-width layout. For icon-only affordances use
 * `IconButton`; for filter toggles use `FilterPill`.
 */
import React from 'react';
import Icon, { type IconType } from '../overview/shared/Icon';

/** Visual treatments: `secondary` is the default; `danger`/`success` carry semantic colour; `ghost` is chromeless. */
export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
/** Height/padding scale — `sm` ≈ 36px, `md` ≈ 40px, `lg` ≈ 56px. */
export type ButtonSize = 'sm' | 'md' | 'lg';

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
}) => {
  const baseClasses = `
    inline-flex items-center justify-center gap-2
    rounded-md transition-all duration-100
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
      {!loading && icon && iconPosition === 'left' && (
        <Icon type={icon} size={size === 'sm' ? 'sm' : 'md'} />
      )}
      <span>{children}</span>
      {!loading && icon && iconPosition === 'right' && (
        <Icon type={icon} size={size === 'sm' ? 'sm' : 'md'} />
      )}
      {badge && (
        <span className="ml-1 px-2 py-0.5 rounded-full text-xs font-bold bg-danger text-white">
          {badge}
        </span>
      )}
    </button>
  );
};

export default Button;
