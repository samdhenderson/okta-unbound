/**
 * @module sidepanel/components/shared/Checkbox
 * @description Controlled checkbox primitive — renders bare or with a label + description.
 *
 * When no `label` is given it emits a bare styled `<input>` so the caller owns
 * layout (in that case supply `aria-label`); with a `label` it wraps the box in
 * a clickable `<label>` plus optional helper text.
 */
import React from 'react';

interface CheckboxProps {
  /** Controlled checked state. */
  checked: boolean;
  /** Called with the new checked value on toggle. */
  onChange: (checked: boolean) => void;
  /** Visible label. When omitted, pass `aria-label` so the control has an accessible name. */
  label?: React.ReactNode;
  /** Secondary helper text rendered beneath the label. */
  description?: React.ReactNode;
  disabled?: boolean;
  /** Extra classes for the wrapping `<label>` (when labeled) or the `<input>` (when bare). */
  className?: string;
  'aria-label'?: string;
}

const inputClasses =
  'w-4 h-4 shrink-0 rounded border-neutral-300 text-primary accent-primary ' +
  'focus:outline-2 focus:outline-offset-2 focus:outline-primary ' +
  'cursor-pointer disabled:cursor-not-allowed disabled:opacity-50';

/**
 * Checkbox primitive for feature components. Renders a bare styled `<input>` when
 * no `label` is given (caller controls layout), or a clickable `<label>` wrapping
 * the box plus label/description text. For text fields use {@link Input}.
 *
 * @example
 * ```tsx
 * <Checkbox
 *   checked={includeDeprovisioned}
 *   onChange={setIncludeDeprovisioned}
 *   label="Include deprovisioned users"
 *   description="Also match users whose Okta status is DEPROVISIONED"
 * />
 * ```
 */
const Checkbox: React.FC<CheckboxProps> = ({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  className = '',
  'aria-label': ariaLabel,
}) => {
  const input = (
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.checked)}
      className={`${inputClasses}${description ? ' mt-0.5' : ''}${label ? '' : ` ${className}`}`.trim()}
    />
  );

  if (label === undefined) return input;

  return (
    <label
      className={`flex gap-2 ${description ? 'items-start' : 'items-center'} ${
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
      } ${className}`
        .trim()
        .replace(/\s+/g, ' ')}
    >
      {input}
      <span>
        <span className="text-sm text-neutral-700">{label}</span>
        {description && (
          <span className="mt-0.5 block text-xs text-neutral-500">{description}</span>
        )}
      </span>
    </label>
  );
};

export default Checkbox;
