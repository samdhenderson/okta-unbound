/**
 * @module sidepanel/components/shared/Input
 * @description Controlled single-line text field with optional label, hint, size scale, leading/trailing adornments, and error state.
 *
 * `onChange` receives the string value (not the event). When `error` is set the
 * field turns red and the error message replaces the hint. Three sizes
 * (`sm | md | lg`) and two in-field slots — `icon` (leading glyph) and `trailing`
 * (clear button, spinner) — whose reserved padding scales with `size`, so a
 * search composite never has to re-declare the field's class string. Use over a
 * raw `<input>`; for multi-line use `Textarea`, for choices use `Select`.
 *
 * `type="search"` suppresses the native WebKit cancel-button
 * (`::-webkit-search-cancel-button`) only when `trailingInteractive` is set —
 * i.e. only when the caller says `trailing` holds something clickable (a
 * clear button), not when it holds a merely decorative node (a spinner). A
 * bare `type="search"` field with no custom clear keeps its native × as its
 * only clear affordance; suppressing it there would delete a working control
 * to fix a cosmetic issue that field doesn't have. `MemberSearchBar` routes
 * its clear button through `trailing`/`trailingInteractive` for exactly this
 * reason, rather than layering its own control on top of the field.
 */
import React from 'react';

/**
 * Field height/type scale — `sm` ≈ 30px, `md` ≈ 38px, `lg` ≈ 46px.
 *
 * `md` is the default and is the historical rendering of this component;
 * `lg` is the taller field search bars use as the primary control of a view.
 */
export type InputSize = 'sm' | 'md' | 'lg';

interface InputProps {
  /** Controlled value. */
  value: string;
  /** Called with the new string value on each change. */
  onChange: (value: string) => void;
  placeholder?: string;
  /** Native input type. Defaults to `text`. */
  type?: 'text' | 'email' | 'password' | 'number' | 'search';
  disabled?: boolean;
  /** Error message; when set, applies danger styling and hides `hint`. */
  error?: string;
  /** Optional field label rendered above the input. */
  label?: string;
  /** Accessible name for the control when no visible `label` is rendered (e.g. an inline field). */
  ariaLabel?: string;
  /** Helper text below the input, shown only when there is no `error`. */
  hint?: string;
  /** Stretch to fill the container width. Defaults to `true`. */
  fullWidth?: boolean;
  /** Field height/type scale. Defaults to `md`. */
  size?: InputSize;
  /** Optional leading icon rendered inside the field; left padding is reserved automatically. */
  icon?: React.ReactNode;
  /**
   * Optional node rendered inside the field at its trailing edge — a clear
   * `IconButton`, a `LoadingSpinner`, a unit suffix. Right padding is reserved
   * automatically (scaled to `size`) so long values never run underneath it.
   * Combines with `icon`.
   */
  trailing?: React.ReactNode;
  /**
   * Set when `trailing` holds something the user clicks (a clear button). By
   * default the slot is `pointer-events-none` so a decorative adornment (a
   * spinner) can't swallow clicks aimed at the field. Also the signal that
   * suppresses the native `type="search"` cancel-button, so a field with a
   * merely decorative `trailing` (a spinner) keeps its native × instead of
   * losing its only clear affordance.
   */
  trailingInteractive?: boolean;
  className?: string;
  /** Focus the input on mount. */
  autoFocus?: boolean;
  /** Key handler on the input (e.g. Enter to submit, Escape to cancel). */
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  /** Ref to the underlying `<input>` (e.g. to refocus after clearing). */
  inputRef?: React.Ref<HTMLInputElement>;
}

/**
 * Padding and type scale per size. `sm` mirrors `Button`'s `sm`
 * (`px-3 py-1.5 text-xs`) so a compact field and a compact button line up in the
 * same toolbar row; `md` is the historical rendering and must not change.
 */
const sizeClasses: Record<InputSize, string> = {
  sm: 'px-3 py-1.5 text-xs', // 30px
  md: 'px-3 py-2 text-sm', // 38px
  lg: 'px-4 py-3 text-sm', // 46px
};

/** Horizontal inset of the adornment wrappers; tracks each size's own padding. */
const leadingInsetClasses: Record<InputSize, string> = {
  sm: 'left-3',
  md: 'left-3',
  lg: 'left-4',
};

/** Mirror of {@link leadingInsetClasses} for the trailing slot. */
const trailingInsetClasses: Record<InputSize, string> = {
  sm: 'right-3',
  md: 'right-3',
  lg: 'right-4',
};

/** Left padding reserved for `icon`: inset + a 16px glyph + a 8–12px gap. */
const leadingPaddingClasses: Record<InputSize, string> = {
  sm: 'pl-9',
  md: 'pl-10',
  lg: 'pl-11',
};

/**
 * Right padding reserved for `trailing`. One step wider than the leading
 * reservation because the trailing slot carries a hit target rather than a bare
 * glyph — this keeps ≥4px of clearance for the widest thing callers put there
 * (`IconButton size="md"`, 28px) at every size.
 */
const trailingPaddingClasses: Record<InputSize, string> = {
  sm: 'pr-10',
  md: 'pr-11',
  lg: 'pr-12',
};

/**
 * The shared controlled text input. Prefer this over a hand-rolled `<input>`.
 *
 * @example
 * ```tsx
 * <Input label="Search" type="search" value={query} onChange={setQuery} error={err} />
 * ```
 *
 * @example A search field with both slots filled
 * ```tsx
 * <Input
 *   size="lg"
 *   value={query}
 *   onChange={setQuery}
 *   ariaLabel="Search users"
 *   icon={<Icon type="search" size="sm" />}
 *   trailingInteractive
 *   trailing={
 *     <IconButton label="Clear search" variant="ghost" size="sm" onClick={clear}>
 *       <Icon type="close" size="sm" />
 *     </IconButton>
 *   }
 * />
 * ```
 */
const Input: React.FC<InputProps> = ({
  value,
  onChange,
  placeholder,
  type = 'text',
  disabled = false,
  error,
  label,
  ariaLabel,
  hint,
  fullWidth = true,
  size = 'md',
  icon,
  trailing,
  trailingInteractive = false,
  className = '',
  autoFocus = false,
  onKeyDown,
  inputRef,
}) => {
  const inputClasses = `
    ${sizeClasses[size]}
    border rounded-md bg-white
    transition-all duration-(--dur-instant)
    focus:outline-2 focus:outline-offset-2 focus:outline-primary
    disabled:bg-neutral-50 disabled:text-neutral-500 disabled:cursor-not-allowed
    ${error ? 'border-danger focus:border-danger' : 'border-neutral-300 focus:border-primary'}
    ${icon ? leadingPaddingClasses[size] : ''}
    ${trailing ? trailingPaddingClasses[size] : ''}
    ${fullWidth ? 'w-full' : ''}
    ${type === 'search' && trailingInteractive ? '[&::-webkit-search-cancel-button]:appearance-none' : ''}
  `
    .trim()
    .replace(/\s+/g, ' ');

  // The trailing node sits outside the <input>, so it never affects focus; only
  // its pointer events can steal from the field, and those are opt-in.
  const trailingClasses = `
    absolute ${trailingInsetClasses[size]} top-1/2 -translate-y-1/2
    flex items-center text-neutral-400
    ${trailingInteractive ? '' : 'pointer-events-none'}
  `
    .trim()
    .replace(/\s+/g, ' ');

  return (
    <div className={`${fullWidth ? 'w-full' : ''} ${className}`}>
      {label && <label className="block text-sm font-medium text-neutral-700 mb-2">{label}</label>}
      <div className="relative">
        {icon && (
          // `pointer-events-none` and `aria-hidden` are not optional here: the icon
          // overlays the field, so without them a click on the glyph misses the
          // input, and a screen reader announces a decorative shape between the
          // label and the control. Every hand-rolled search field this primitive
          // replaced carried both; they were lost in the migration and are restored
          // here rather than at each call site.
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute ${leadingInsetClasses[size]} top-1/2 -translate-y-1/2 text-neutral-400`}
          >
            {icon}
          </div>
        )}
        <input
          ref={inputRef}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          aria-label={ariaLabel}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          className={inputClasses}
          style={{ fontFamily: 'var(--font-primary)' }}
        />
        {trailing && <div className={trailingClasses}>{trailing}</div>}
      </div>
      {hint && !error && <p className="mt-1 text-xs text-neutral-500">{hint}</p>}
      {error && (
        <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
};

export default Input;
