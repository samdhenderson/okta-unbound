/**
 * @module sidepanel/hooks/useValidation
 * @description Field-keyed form validation state and helpers.
 *
 * Holds a map of field name → error message and exposes helpers to validate a
 * `ValidationResult`, set/clear errors, and query error state. Also exports the
 * `FieldError` presentational component for rendering a single field's error.
 */

import { useState, useCallback, useMemo } from 'react';
import type { ValidationResult } from '../../shared/utils/validation';

/** Map of field name to its current error message (undefined when valid). */
interface ValidationState {
  [field: string]: string | undefined;
}

/** Return shape of {@link useValidation}. */
interface UseValidationReturn {
  /** Current validation errors by field name */
  errors: ValidationState;
  /** Validate a field and store error if invalid. Returns true if valid. */
  validate: (field: string, result: ValidationResult) => boolean;
  /** Set an error for a field manually */
  setError: (field: string, error: string) => void;
  /** Clear error for a specific field */
  clearError: (field: string) => void;
  /** Clear all errors */
  clearAllErrors: () => void;
  /** Check if any errors exist */
  hasErrors: boolean;
  /** Get error for a specific field */
  getError: (field: string) => string | undefined;
  /** Check if a specific field has an error */
  hasError: (field: string) => boolean;
}

/**
 * Manages per-field validation errors for a form.
 *
 * @returns The `errors` map plus `validate` (stores/clears based on a
 *   `ValidationResult`, returns validity), `setError`, `clearError`,
 *   `clearAllErrors`, `getError`, `hasError`, and the aggregate `hasErrors`.
 *
 * @example
 * ```tsx
 * const { errors, validate, clearError, hasErrors } = useValidation();
 *
 * const handleSubmit = () => {
 *   if (validate('userId', validateUserId(userId))) {
 *     // proceed
 *   }
 * };
 * ```
 */
export function useValidation(): UseValidationReturn {
  const [errors, setErrors] = useState<ValidationState>({});

  const validate = useCallback((field: string, result: ValidationResult): boolean => {
    if (result.isValid) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
      return true;
    } else {
      setErrors((prev) => ({
        ...prev,
        [field]: result.error,
      }));
      return false;
    }
  }, []);

  const setError = useCallback((field: string, error: string) => {
    setErrors((prev) => ({
      ...prev,
      [field]: error,
    }));
  }, []);

  const clearError = useCallback((field: string) => {
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const clearAllErrors = useCallback(() => {
    setErrors({});
  }, []);

  const hasErrors = useMemo(() => Object.keys(errors).length > 0, [errors]);

  const getError = useCallback(
    (field: string): string | undefined => {
      return errors[field];
    },
    [errors],
  );

  const hasError = useCallback(
    (field: string): boolean => {
      return !!errors[field];
    },
    [errors],
  );

  return {
    errors,
    validate,
    setError,
    clearError,
    clearAllErrors,
    hasErrors,
    getError,
    hasError,
  };
}

/**
 * Renders a single field's error message, or nothing when there is no error.
 * The `error` prop is the text to display; a falsy value renders `null`.
 */
export function FieldError({ error }: { error?: string }) {
  if (!error) return null;
  return <span className="field-error">{error}</span>;
}
