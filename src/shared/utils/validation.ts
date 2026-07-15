/**
 * @module shared/utils/validation
 * @description Okta ID / email / search-query validation and light input sanitization.
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

/** Outcome of validating a single value. */
export interface ValidationResult {
  /** Whether the value passed validation. */
  isValid: boolean;
  /** Human-readable reason when `isValid` is `false`. */
  error?: string;
  /** The cleaned value (e.g. trimmed / lower-cased) when `isValid` is `true`. */
  normalized?: string;
}

/** Result of splitting a free-form string into recognized vs. rejected IDs. */
export interface ParsedIds {
  /** Normalized IDs that passed validation. */
  valid: string[];
  /** Raw candidate tokens that failed validation. */
  invalid: string[];
  /** Per-candidate error messages for the invalid tokens. */
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
 * Validate a single Okta ID against the pattern for the given entity type.
 *
 * Checks presence, length (20), prefix, and allowed characters in that order,
 * returning the first failure reason.
 *
 * @param id - The candidate ID.
 * @param type - The entity type (`'user' | 'group' | 'app' | 'rule'`).
 * @returns A {@link ValidationResult}; `normalized` holds the trimmed ID when valid.
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
      error: `${type} ID must be 20 characters (got ${trimmed.length})`,
    };
  }

  if (!trimmed.startsWith(ID_PREFIXES[type])) {
    return {
      isValid: false,
      error: `${type} ID must start with "${ID_PREFIXES[type]}"`,
    };
  }

  if (!ID_PATTERNS[type].test(trimmed)) {
    return {
      isValid: false,
      error: `${type} ID contains invalid characters`,
    };
  }

  return { isValid: true, normalized: trimmed };
}

/**
 * Validate an Okta user ID (`00u…`).
 *
 * @param id - The candidate ID.
 * @returns A {@link ValidationResult}. See {@link validateId}.
 */
export function validateUserId(id: string): ValidationResult {
  return validateId(id, 'user');
}

/**
 * Validate an Okta group ID (`00g…`).
 *
 * @param id - The candidate ID.
 * @returns A {@link ValidationResult}. See {@link validateId}.
 */
export function validateGroupId(id: string): ValidationResult {
  return validateId(id, 'group');
}

/**
 * Validate an Okta app ID (`0oa…`).
 *
 * @param id - The candidate ID.
 * @returns A {@link ValidationResult}. See {@link validateId}.
 */
export function validateAppId(id: string): ValidationResult {
  return validateId(id, 'app');
}

/**
 * Validate an Okta rule ID (`0pr…`).
 *
 * @param id - The candidate ID.
 * @returns A {@link ValidationResult}. See {@link validateId}.
 */
export function validateRuleId(id: string): ValidationResult {
  return validateId(id, 'rule');
}

/**
 * Parse a free-form string of Okta IDs (comma-, newline-, or whitespace-separated)
 * and partition them into valid and invalid sets.
 *
 * @param input - The raw multi-ID string.
 * @param type - The entity type each candidate is validated as.
 * @returns A {@link ParsedIds} with normalized valid IDs, raw invalid tokens, and
 *   per-token error messages.
 *
 * @example
 * const { valid, invalid } = parseIds('00u...aaa, bad', 'user');
 */
export function parseIds(input: string, type: IdType): ParsedIds {
  if (!input || typeof input !== 'string') {
    return { valid: [], invalid: [], errors: [] };
  }

  // Split by comma, newline, or whitespace
  const candidates = input
    .split(/[,\n\s]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

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
 * Validate an email address with a permissive (not RFC-exhaustive) pattern.
 *
 * @param email - The candidate email.
 * @returns A {@link ValidationResult}; `normalized` holds the trimmed, lower-cased
 *   address when valid.
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
 * Validate a search query for non-emptiness and a reasonable length bound.
 *
 * @param query - The raw query string.
 * @param minLength - Minimum trimmed length, inclusive (default `2`).
 * @param maxLength - Maximum trimmed length, inclusive (default `100`).
 * @returns A {@link ValidationResult}; `normalized` holds the trimmed query when valid.
 */
export function validateSearchQuery(
  query: string,
  minLength = 2,
  maxLength = 100,
): ValidationResult {
  if (!query || typeof query !== 'string') {
    return { isValid: false, error: 'Search query is required' };
  }

  const trimmed = query.trim();

  if (trimmed.length < minLength) {
    return {
      isValid: false,
      error: `Search query must be at least ${minLength} characters`,
    };
  }

  if (trimmed.length > maxLength) {
    return {
      isValid: false,
      error: `Search query must be less than ${maxLength} characters`,
    };
  }

  return { isValid: true, normalized: trimmed };
}

/**
 * Escape HTML-significant characters (`& < > " '`) so a string can be shown as
 * literal text, mitigating XSS in dynamically composed markup.
 *
 * @param str - The raw string.
 * @returns The HTML-escaped string; empty string for nullish/non-string input.
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
 * Detect whether a value matches any known Okta ID pattern and, if so, which type.
 *
 * @param value - The candidate string.
 * @returns `{ isOktaId: true, type }` when it matches a pattern, otherwise
 *   `{ isOktaId: false }`.
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
 * Format a list of validation error messages into a single display string.
 *
 * One error is returned as-is; multiple are rendered as a bulleted list with a
 * count header. An empty list yields an empty string.
 *
 * @param errors - The individual error messages.
 * @returns A display-ready string.
 */
export function formatValidationErrors(errors: string[]): string {
  if (errors.length === 0) return '';
  if (errors.length === 1) return errors[0];
  return `${errors.length} validation errors:\n• ${errors.join('\n• ')}`;
}
