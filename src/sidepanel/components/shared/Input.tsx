/**
 * @module sidepanel/components/shared/Input
 * @description Controlled single-line text field with optional label, hint, leading icon, and error state.
 *
 * `onChange` receives the string value (not the event). When `error` is set the
 * field turns red and the error message replaces the hint. Use over a raw
 * `<input>`; for multi-line use `Textarea`, for choices use `Select`.
 */
import React from 'react';

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
  /** Helper text below the input, shown only when there is no `error`. */
  hint?: string;
  /** Stretch to fill the container width. Defaults to `true`. */
  fullWidth?: boolean;
  /** Optional leading icon rendered inside the field. */
  icon?: React.ReactNode;
  className?: string;
  /** Focus the input on mount. */
  autoFocus?: boolean;
  /** Key handler on the input (e.g. Enter to submit, Escape to cancel). */
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  /** Ref to the underlying `<input>` (e.g. to refocus after clearing). */
  inputRef?: React.Ref<HTMLInputElement>;
}

/**
 * The shared controlled text input. Prefer this over a hand-rolled `<input>`.
 *
 * @example
 * ```tsx
 * <Input label="Search" type="search" value={query} onChange={setQuery} error={err} />
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
  hint,
  fullWidth = true,
  icon,
  className = '',
  autoFocus = false,
  onKeyDown,
  inputRef,
}) => {
  const inputClasses = `
    px-3 py-2 text-sm
    border rounded-md bg-white
    transition-all duration-100
    focus:outline-2 focus:outline-offset-2 focus:outline-primary
    disabled:bg-neutral-50 disabled:text-neutral-500 disabled:cursor-not-allowed
    ${error ? 'border-danger focus:border-danger' : 'border-neutral-300 focus:border-primary'}
    ${icon ? 'pl-10' : ''}
    ${fullWidth ? 'w-full' : ''}
  `
    .trim()
    .replace(/\s+/g, ' ');

  return (
    <div className={`${fullWidth ? 'w-full' : ''} ${className}`}>
      {label && <label className="block text-sm font-medium text-neutral-700 mb-2">{label}</label>}
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">{icon}</div>
        )}
        <input
          ref={inputRef}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          className={inputClasses}
          style={{ fontFamily: 'var(--font-primary)' }}
        />
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
