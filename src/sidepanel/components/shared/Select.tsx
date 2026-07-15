/**
 * @module sidepanel/components/shared/Select
 * @description Controlled native `<select>` dropdown built from an options array, with label + error state.
 *
 * `onChange` receives the chosen option value (not the event). Use over a raw
 * `<select>`; for free text use `Input`.
 */
import React from 'react';

/** A single `<option>`: `value` is the submitted value, `label` the visible text. */
interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  /** Controlled selected value. */
  value: string;
  /** Called with the newly selected option value. */
  onChange: (value: string) => void;
  /** Options to render. */
  options: SelectOption[];
  /** Optional label rendered above the control. */
  label?: string;
  /** Error message; when set, applies danger styling and shows the message below. */
  error?: string;
  disabled?: boolean;
  /** Stretch to fill the container width. Defaults to `true`. */
  fullWidth?: boolean;
  className?: string;
}

/**
 * The shared controlled dropdown. Prefer this over a hand-rolled `<select>`.
 *
 * @example
 * ```tsx
 * <Select
 *   label="Status"
 *   value={status}
 *   onChange={setStatus}
 *   options={[{ value: 'ACTIVE', label: 'Active' }, { value: 'STAGED', label: 'Staged' }]}
 * />
 * ```
 */
const Select: React.FC<SelectProps> = ({
  value,
  onChange,
  options,
  label,
  error,
  disabled = false,
  fullWidth = true,
  className = '',
}) => {
  const selectClasses = `
    px-3 py-2 text-sm
    border rounded-md
    transition-all duration-100
    focus:outline-2 focus:outline-offset-2 focus:outline-primary
    disabled:bg-neutral-50 disabled:text-neutral-500 disabled:cursor-not-allowed
    bg-white
    ${error ? 'border-danger focus:border-danger' : 'border-neutral-300 focus:border-primary'}
    ${fullWidth ? 'w-full' : ''}
  `
    .trim()
    .replace(/\s+/g, ' ');

  return (
    <div className={`${fullWidth ? 'w-full' : ''} ${className}`}>
      {label && <label className="block text-sm font-medium text-neutral-700 mb-2">{label}</label>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={selectClasses}
        style={{ fontFamily: 'var(--font-primary)' }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
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

export default Select;
