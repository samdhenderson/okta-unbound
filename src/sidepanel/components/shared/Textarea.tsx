/**
 * @module sidepanel/components/shared/Textarea
 * @description Controlled multi-line text field with label, hint, and error state; vertically resizable.
 *
 * The multi-line sibling of `Input`. `onChange` receives the string value
 * (not the event); when `error` is set the field turns red and the message
 * replaces the hint.
 */
import React from 'react';

interface TextareaProps {
  /** Controlled value. */
  value: string;
  /** Called with the new string value on each change. */
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Error message; when set, applies danger styling and hides `hint`. */
  error?: string;
  /** Optional label rendered above the field. */
  label?: string;
  /** Helper text below the field, shown only when there is no `error`. */
  hint?: string;
  /** Visible row count. Defaults to `4`. */
  rows?: number;
  /** Stretch to fill the container width. Defaults to `true`. */
  fullWidth?: boolean;
  className?: string;
}

/**
 * The shared controlled multi-line input. Prefer this over a raw `<textarea>`.
 *
 * @example
 * ```tsx
 * <Textarea label="Notes" value={notes} onChange={setNotes} rows={6} />
 * ```
 */
const Textarea: React.FC<TextareaProps> = ({
  value,
  onChange,
  placeholder,
  disabled = false,
  error,
  label,
  hint,
  rows = 4,
  fullWidth = true,
  className = '',
}) => {
  const textareaClasses = `
    px-3 py-2 text-sm
    border rounded-md
    transition-all duration-100
    focus:outline-2 focus:outline-offset-2 focus:outline-primary
    disabled:bg-neutral-50 disabled:text-neutral-500 disabled:cursor-not-allowed
    resize-vertical
    ${error ? 'border-danger focus:border-danger' : 'border-neutral-300 focus:border-primary'}
    ${fullWidth ? 'w-full' : ''}
  `
    .trim()
    .replace(/\s+/g, ' ');

  return (
    <div className={`${fullWidth ? 'w-full' : ''} ${className}`}>
      {label && <label className="block text-sm font-medium text-neutral-700 mb-2">{label}</label>}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        rows={rows}
        className={textareaClasses}
        style={{ fontFamily: 'var(--font-primary)' }}
      />
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

export default Textarea;
