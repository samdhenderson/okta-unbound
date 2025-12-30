/**
 * Okta ID Validation Utilities
 *
 * Okta IDs follow specific patterns:
 * - Users: 00u + 17 alphanumeric characters (20 chars total)
 * - Groups: 00g + 17 alphanumeric characters (20 chars total)
 * - Apps: 0oa + 17 alphanumeric characters (20 chars total)
 * - Rules: 0pr + 17 alphanumeric characters (20 chars total)
 *
 * @example
 * import { validateUserId, validateGroupId, parseIds } from './validation';
 *
 * if (validateUserId(userId).isValid) {
 *   // proceed with API call
 * }
 *
 * const { valid, invalid } = parseIds(userInput, 'user');
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  normalized?: string;
}

export interface ParsedIds {
  valid: string[];
  invalid: string[];
  errors: string[];
}

// Okta ID patterns
const ID_PATTERNS = {
  user: /^00u[a-zA-Z0-9]{17}$/,
  group: /^00g[a-zA-Z0-9]{17}$/,
  app: /^0oa[a-zA-Z0-9]{17}$/,
  rule: /^0pr[a-zA-Z0-9]{17}$/,
} as const;

const ID_PREFIXES = {
  user: '00u',
  group: '00g',
  app: '0oa',
  rule: '0pr',
} as const;

type IdType = keyof typeof ID_PATTERNS;

/**
 * Validates a single Okta ID
 */
export function validateId(id: string, type: IdType): ValidationResult {
  if (!id || typeof id !== 'string') {
    return { isValid: false, error: `${type} ID is required` };
  }

  const trimmed = id.trim();

  if (trimmed.length === 0) {
    return { isValid: false, error: `${type} ID cannot be empty` };
  }

  if (trimmed.length !== 20) {
    return {
      isValid: false,
      error: `${type} ID must be 20 characters (got ${trimmed.length})`
    };
  }

  if (!trimmed.startsWith(ID_PREFIXES[type])) {
    return {
      isValid: false,
      error: `${type} ID must start with "${ID_PREFIXES[type]}"`
    };
  }

  if (!ID_PATTERNS[type].test(trimmed)) {
    return {
      isValid: false,
      error: `${type} ID contains invalid characters`
    };
  }

  return { isValid: true, normalized: trimmed };
}

/**
 * Validates a user ID (00u...)
 */
export function validateUserId(id: string): ValidationResult {
  return validateId(id, 'user');
}

/**
 * Validates a group ID (00g...)
 */
export function validateGroupId(id: string): ValidationResult {
  return validateId(id, 'group');
}

/**
 * Validates an app ID (0oa...)
 */
export function validateAppId(id: string): ValidationResult {
  return validateId(id, 'app');
}

/**
 * Validates a rule ID (0pr...)
 */
export function validateRuleId(id: string): ValidationResult {
  return validateId(id, 'rule');
}

/**
 * Parses a string containing multiple IDs (comma, newline, or space separated)
 * Returns valid and invalid IDs separately
 */
export function parseIds(input: string, type: IdType): ParsedIds {
  if (!input || typeof input !== 'string') {
    return { valid: [], invalid: [], errors: [] };
  }

  // Split by comma, newline, or whitespace
  const candidates = input
    .split(/[,\n\s]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  const valid: string[] = [];
  const invalid: string[] = [];
  const errors: string[] = [];

  for (const candidate of candidates) {
    const result = validateId(candidate, type);
    if (result.isValid && result.normalized) {
      valid.push(result.normalized);
    } else {
      invalid.push(candidate);
      if (result.error) {
        errors.push(`"${candidate}": ${result.error}`);
      }
    }
  }

  return { valid, invalid, errors };
}

/**
 * Validates an email address
 */
export function validateEmail(email: string): ValidationResult {
  if (!email || typeof email !== 'string') {
    return { isValid: false, error: 'Email is required' };
  }

  const trimmed = email.trim().toLowerCase();

  if (trimmed.length === 0) {
    return { isValid: false, error: 'Email cannot be empty' };
  }

  // Basic email pattern - not overly strict
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailPattern.test(trimmed)) {
    return { isValid: false, error: 'Invalid email format' };
  }

  return { isValid: true, normalized: trimmed };
}

/**
 * Validates a search query (non-empty, reasonable length)
 */
export function validateSearchQuery(query: string, minLength = 2, maxLength = 100): ValidationResult {
  if (!query || typeof query !== 'string') {
    return { isValid: false, error: 'Search query is required' };
  }

  const trimmed = query.trim();

  if (trimmed.length < minLength) {
    return {
      isValid: false,
      error: `Search query must be at least ${minLength} characters`
    };
  }

  if (trimmed.length > maxLength) {
    return {
      isValid: false,
      error: `Search query must be less than ${maxLength} characters`
    };
  }

  return { isValid: true, normalized: trimmed };
}

/**
 * Sanitizes a string for safe display (prevents XSS in dynamic content)
 */
export function sanitizeDisplayString(str: string): string {
  if (!str || typeof str !== 'string') {
    return '';
  }

  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Checks if a value looks like an Okta ID (any type)
 */
export function looksLikeOktaId(value: string): { isOktaId: boolean; type?: IdType } {
  if (!value || typeof value !== 'string' || value.length !== 20) {
    return { isOktaId: false };
  }

  for (const [type, pattern] of Object.entries(ID_PATTERNS)) {
    if (pattern.test(value)) {
      return { isOktaId: true, type: type as IdType };
    }
  }

  return { isOktaId: false };
}

/**
 * Formats validation errors for display
 */
export function formatValidationErrors(errors: string[]): string {
  if (errors.length === 0) return '';
  if (errors.length === 1) return errors[0];
  return `${errors.length} validation errors:\n• ${errors.join('\n• ')}`;
}
