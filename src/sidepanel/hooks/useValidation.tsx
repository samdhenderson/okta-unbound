/**
 * React Hook for Form Validation
 *
 * Provides validation state management and helpers for forms
 *
 * @example
 * const { errors, validate, clearError, hasErrors } = useValidation();
 *
 * const handleSubmit = () => {
 *   if (validate('userId', validateUserId(userId))) {
 *     // proceed
 *   }
 * };
 */

import { useState, useCallback, useMemo } from 'react';
import type { ValidationResult } from '../../shared/utils/validation';

interface ValidationState {
  [field: string]: string | undefined;
}

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

export function useValidation(): UseValidationReturn {
  const [errors, setErrors] = useState<ValidationState>({});

  const validate = useCallback((field: string, result: ValidationResult): boolean => {
    if (result.isValid) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
      return true;
    } else {
      setErrors(prev => ({
        ...prev,
        [field]: result.error,
      }));
      return false;
    }
  }, []);

  const setError = useCallback((field: string, error: string) => {
    setErrors(prev => ({
      ...prev,
      [field]: error,
    }));
  }, []);

  const clearError = useCallback((field: string) => {
    setErrors(prev => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const clearAllErrors = useCallback(() => {
    setErrors({});
  }, []);

  const hasErrors = useMemo(() => Object.keys(errors).length > 0, [errors]);

  const getError = useCallback((field: string): string | undefined => {
    return errors[field];
  }, [errors]);

  const hasError = useCallback((field: string): boolean => {
    return !!errors[field];
  }, [errors]);

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
 * Helper component for displaying field errors
 */
export function FieldError({ error }: { error?: string }) {
  if (!error) return null;
  return <span className="field-error">{error}</span>;
}
