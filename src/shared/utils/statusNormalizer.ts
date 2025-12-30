/**
 * @module utils/statusNormalizer
 * @description Centralized utility for normalizing Okta user status values from various API sources.
 *
 * ## Problem Context
 * Okta has two different APIs that return user status in different formats:
 *
 * 1. **Public API** (`/api/v1/groups/{id}/users`):
 *    - Returns canonical API status names
 *    - Examples: ACTIVE, DEPROVISIONED, SUSPENDED, STAGED, etc.
 *
 * 2. **Internal Admin API** (`/admin/users/search`):
 *    - Returns UI display labels (as shown in Admin Console)
 *    - Examples: Active, Deactivated, Suspended, Staged, etc.
 *
 * ## Status Mappings
 *
 * | API Status (Canonical) | Admin Console UI Label  | Description                |
 * |------------------------|-------------------------|----------------------------|
 * | STAGED                 | Staged                  | User created, not activated|
 * | PROVISIONED            | Pending User Action     | Waiting for user setup     |
 * | ACTIVE                 | Active                  | Active user account        |
 * | RECOVERY               | Password Reset          | Password recovery mode     |
 * | PASSWORD_EXPIRED       | Password Expired        | Password needs reset       |
 * | LOCKED_OUT             | Locked Out              | Account locked             |
 * | SUSPENDED              | Suspended               | Temporarily suspended      |
 * | DEPROVISIONED          | Deactivated             | Deactivated/removed        |
 *
 * @example
 * ```typescript
 * import { normalizeUserStatus } from '@/shared/utils/statusNormalizer';
 *
 * // From Public API
 * normalizeUserStatus('DEPROVISIONED') // => 'DEPROVISIONED'
 *
 * // From Internal Admin API
 * normalizeUserStatus('Deactivated') // => 'DEPROVISIONED'
 *
 * // From HTML content
 * normalizeUserStatus('<span class="badge">Active</span>') // => 'ACTIVE'
 *
 * // Handle edge cases
 * normalizeUserStatus(null) // => 'ACTIVE' (safe default)
 * normalizeUserStatus('') // => 'ACTIVE' (safe default)
 * normalizeUserStatus({ text: 'Suspended' }) // => 'SUSPENDED'
 * ```
 */

import type { UserStatus } from '../types';

/**
 * Comprehensive mapping of all possible status variations to canonical UserStatus values.
 * Includes:
 * - API canonical names (uppercase with underscores)
 * - Admin Console UI labels (title case)
 * - Common variations (different casing, with/without spaces/underscores)
 */
const STATUS_MAP: Record<string, UserStatus> = {
  // ========================================
  // API Status Names (Canonical)
  // ========================================
  'ACTIVE': 'ACTIVE',
  'DEPROVISIONED': 'DEPROVISIONED',
  'SUSPENDED': 'SUSPENDED',
  'STAGED': 'STAGED',
  'PROVISIONED': 'PROVISIONED',
  'RECOVERY': 'RECOVERY',
  'LOCKED_OUT': 'LOCKED_OUT',
  'PASSWORD_EXPIRED': 'PASSWORD_EXPIRED',

  // ========================================
  // Admin Console UI Labels
  // ========================================
  'DEACTIVATED': 'DEPROVISIONED',       // UI shows "Deactivated" for DEPROVISIONED
  'PENDING_USER_ACTION': 'PROVISIONED', // UI shows "Pending User Action"
  'PENDING USER ACTION': 'PROVISIONED',  // Space-separated variant
  'PASSWORD_RESET': 'RECOVERY',         // UI shows "Password Reset"
  'PASSWORD RESET': 'RECOVERY',          // Space-separated variant

  // ========================================
  // Common Variations (no underscores)
  // ========================================
  'LOCKEDOUT': 'LOCKED_OUT',
  'LOCKED OUT': 'LOCKED_OUT',
  'PASSWORDEXPIRED': 'PASSWORD_EXPIRED',
  'PASSWORD EXPIRED': 'PASSWORD_EXPIRED',

  // ========================================
  // Mixed Case Variations
  // ========================================
  'Active': 'ACTIVE',
  'Deprovisioned': 'DEPROVISIONED',
  'Deactivated': 'DEPROVISIONED',
  'Suspended': 'SUSPENDED',
  'Staged': 'STAGED',
  'Provisioned': 'PROVISIONED',
  'Recovery': 'RECOVERY',
  'Locked Out': 'LOCKED_OUT',
  'Locked_Out': 'LOCKED_OUT',
  'LockedOut': 'LOCKED_OUT',
  'Password Expired': 'PASSWORD_EXPIRED',
  'Password_Expired': 'PASSWORD_EXPIRED',
  'PasswordExpired': 'PASSWORD_EXPIRED',
  'Password Reset': 'RECOVERY',
  'Password_Reset': 'RECOVERY',
  'PasswordReset': 'RECOVERY',
  'Pending User Action': 'PROVISIONED',
  'Pending_User_Action': 'PROVISIONED',
  'PendingUserAction': 'PROVISIONED',
};

/**
 * Safe default status when normalization fails or input is invalid.
 * ACTIVE is chosen as the safest assumption since:
 * - It's the most common status
 * - Less risky than assuming inactive states
 * - Prevents filtering out potentially valid users
 */
const DEFAULT_STATUS: UserStatus = 'ACTIVE';

/**
 * Normalizes any status value to a canonical UserStatus enum value.
 *
 * Handles various input formats:
 * - String values (API names, UI labels, variations)
 * - HTML strings (extracts text content from tags)
 * - Objects with status properties (text, label, status, value, etc.)
 * - null/undefined (returns safe default)
 * - Empty strings (returns safe default)
 *
 * @param statusValue - The status value to normalize (string, object, HTML, null, etc.)
 * @param context - Optional context for debugging (e.g., 'user:00u123', 'api:/admin/users')
 * @returns Normalized UserStatus enum value
 *
 * @example
 * ```typescript
 * // API canonical names
 * normalizeUserStatus('DEPROVISIONED') // => 'DEPROVISIONED'
 * normalizeUserStatus('ACTIVE') // => 'ACTIVE'
 *
 * // Admin Console UI labels
 * normalizeUserStatus('Deactivated') // => 'DEPROVISIONED'
 * normalizeUserStatus('Pending User Action') // => 'PROVISIONED'
 * normalizeUserStatus('Password Reset') // => 'RECOVERY'
 *
 * // HTML content (from UI scraping)
 * normalizeUserStatus('<span class="badge badge-success">Active</span>') // => 'ACTIVE'
 * normalizeUserStatus('<div>Suspended</div>') // => 'SUSPENDED'
 *
 * // Object formats
 * normalizeUserStatus({ text: 'Locked Out' }) // => 'LOCKED_OUT'
 * normalizeUserStatus({ label: 'Deactivated' }) // => 'DEPROVISIONED'
 * normalizeUserStatus({ status: 'SUSPENDED' }) // => 'SUSPENDED'
 *
 * // Edge cases
 * normalizeUserStatus(null) // => 'ACTIVE' (safe default)
 * normalizeUserStatus('') // => 'ACTIVE' (safe default)
 * normalizeUserStatus('UnknownStatus') // => 'ACTIVE' (safe default, with warning)
 *
 * // With context for better debugging
 * normalizeUserStatus('Invalid', 'user:00u123') // Logs: [statusNormalizer] Unknown status for user:00u123
 * ```
 */
export function normalizeUserStatus(statusValue: unknown, context?: string): UserStatus {
  // ========================================
  // Handle null/undefined
  // ========================================
  if (statusValue == null) {
    console.warn(`[statusNormalizer] Status is null/undefined${context ? ` for ${context}` : ''}`);
    return DEFAULT_STATUS;
  }

  // ========================================
  // Handle object with status property
  // ========================================
  if (typeof statusValue === 'object') {
    const obj = statusValue as Record<string, unknown>;

    // Try common property names: text, label, status, statusLabel, value
    const possibleKeys = ['text', 'label', 'status', 'statusLabel', 'value'];
    for (const key of possibleKeys) {
      const value = obj[key];
      if (value && typeof value === 'string') {
        return normalizeUserStatus(value, context);
      }
    }

    // Object doesn't have a recognizable status property
    console.warn(`[statusNormalizer] Status is object without recognizable property${context ? ` for ${context}` : ''}`, statusValue);
    return DEFAULT_STATUS;
  }

  // ========================================
  // Handle non-string primitives
  // ========================================
  if (typeof statusValue !== 'string') {
    console.warn(`[statusNormalizer] Status is not a string${context ? ` for ${context}` : ''}`, typeof statusValue, statusValue);
    return DEFAULT_STATUS;
  }

  // ========================================
  // Handle empty string
  // ========================================
  if (!statusValue.trim()) {
    console.warn(`[statusNormalizer] Status is empty string${context ? ` for ${context}` : ''}`);
    return DEFAULT_STATUS;
  }

  // ========================================
  // Extract text from HTML tags
  // ========================================
  let cleanStatus = statusValue;
  if (statusValue.includes('<') && statusValue.includes('>')) {
    cleanStatus = statusValue.replace(/<[^>]*>/g, '').trim();
    console.debug(`[statusNormalizer] Extracted from HTML: "${statusValue}" => "${cleanStatus}"`);
  }

  // ========================================
  // Normalize to uppercase with underscores
  // ========================================
  const normalizedKey = cleanStatus.trim().toUpperCase().replace(/\s+/g, '_');

  // ========================================
  // Look up in status map
  // ========================================
  const result = STATUS_MAP[normalizedKey];

  if (!result) {
    // Unknown status - log warning and return safe default
    console.warn(
      `[statusNormalizer] Unknown status after normalization: "${normalizedKey}" from original: "${statusValue}"${context ? ` for ${context}` : ''}`
    );
    return DEFAULT_STATUS;
  }

  return result;
}

/**
 * Checks if a given value is a valid canonical UserStatus.
 * This is stricter than normalizeUserStatus - it only accepts exact canonical values.
 *
 * @param value - The value to check
 * @returns True if the value is a valid UserStatus enum value
 *
 * @example
 * ```typescript
 * isValidUserStatus('ACTIVE') // => true
 * isValidUserStatus('DEPROVISIONED') // => true
 * isValidUserStatus('Deactivated') // => false (UI label, not canonical)
 * isValidUserStatus('active') // => false (wrong case)
 * isValidUserStatus(null) // => false
 * ```
 */
export function isValidUserStatus(value: unknown): value is UserStatus {
  const validStatuses: UserStatus[] = [
    'ACTIVE',
    'DEPROVISIONED',
    'SUSPENDED',
    'STAGED',
    'PROVISIONED',
    'RECOVERY',
    'LOCKED_OUT',
    'PASSWORD_EXPIRED',
  ];

  return typeof value === 'string' && validStatuses.includes(value as UserStatus);
}

/**
 * Batch normalizes an array of status values.
 * Useful for processing multiple status values at once with consistent error handling.
 *
 * @param statuses - Array of status values to normalize
 * @param contextPrefix - Optional context prefix for debugging (e.g., 'batch:groupId123')
 * @returns Array of normalized UserStatus values
 *
 * @example
 * ```typescript
 * const rawStatuses = ['Active', 'Deactivated', null, 'Suspended'];
 * const normalized = normalizeUserStatusBatch(rawStatuses);
 * // => ['ACTIVE', 'DEPROVISIONED', 'ACTIVE', 'SUSPENDED']
 *
 * // With context
 * normalizeUserStatusBatch(statuses, 'group:00g123');
 * // Warnings will include: "for group:00g123[0]", "for group:00g123[1]", etc.
 * ```
 */
export function normalizeUserStatusBatch(statuses: unknown[], contextPrefix?: string): UserStatus[] {
  return statuses.map((status, index) => {
    const context = contextPrefix ? `${contextPrefix}[${index}]` : `index:${index}`;
    return normalizeUserStatus(status, context);
  });
}

/**
 * Type guard that checks if a string is a UI label that needs normalization.
 * Useful for debugging and logging.
 *
 * @param value - The status string to check
 * @returns True if the value is a UI label (not a canonical API status)
 *
 * @example
 * ```typescript
 * isUiLabel('Deactivated') // => true
 * isUiLabel('Pending User Action') // => true
 * isUiLabel('DEPROVISIONED') // => false (canonical)
 * isUiLabel('ACTIVE') // => false (canonical)
 * ```
 */
export function isUiLabel(value: string): boolean {
  const trimmedValue = value.trim();
  const normalizedKey = trimmedValue.toUpperCase().replace(/\s+/g, '_');
  const canonicalStatus = STATUS_MAP[normalizedKey];

  // If it doesn't map to a valid status, it's not a UI label
  if (!canonicalStatus) {
    return false;
  }

  // If the original value exactly matches the canonical form (all caps with underscores), it's NOT a UI label
  // Examples: "LOCKED_OUT" is canonical, "Locked Out" or "Locked_Out" are UI labels
  return trimmedValue !== canonicalStatus;
}

/**
 * Mapping from canonical UserStatus values to user-friendly UI labels.
 * These match the labels shown in the Okta Admin Console.
 */
const UI_LABELS: Record<UserStatus, string> = {
  ACTIVE: 'Active',
  DEPROVISIONED: 'Deactivated',
  SUSPENDED: 'Suspended',
  STAGED: 'Staged',
  PROVISIONED: 'Pending User Action',
  RECOVERY: 'Password Reset',
  LOCKED_OUT: 'Locked Out',
  PASSWORD_EXPIRED: 'Password Expired',
};

/**
 * Converts a canonical UserStatus value to its user-friendly UI label.
 * This is the reverse operation of normalizeUserStatus.
 *
 * Use this when displaying status values to users in the UI to match
 * the terminology used in the Okta Admin Console.
 *
 * @param status - The canonical UserStatus to convert
 * @returns User-friendly display label
 *
 * @example
 * ```typescript
 * // For display in UI components
 * getUserFriendlyStatus('DEPROVISIONED') // => 'Deactivated'
 * getUserFriendlyStatus('PROVISIONED') // => 'Pending User Action'
 * getUserFriendlyStatus('RECOVERY') // => 'Password Reset'
 * getUserFriendlyStatus('LOCKED_OUT') // => 'Locked Out'
 * getUserFriendlyStatus('ACTIVE') // => 'Active'
 *
 * // Round-trip conversion
 * const canonical = normalizeUserStatus('Deactivated'); // => 'DEPROVISIONED'
 * const friendly = getUserFriendlyStatus(canonical); // => 'Deactivated'
 * ```
 */
export function getUserFriendlyStatus(status: UserStatus): string {
  return UI_LABELS[status];
}

/**
 * Gets all user-friendly status labels as a Record.
 * Useful for building UI components that need to display all possible statuses.
 *
 * @returns Record mapping canonical UserStatus to user-friendly labels
 *
 * @example
 * ```typescript
 * const labels = getAllUserFriendlyLabels();
 * // { ACTIVE: 'Active', DEPROVISIONED: 'Deactivated', ... }
 *
 * // Use in a dropdown
 * Object.entries(labels).map(([status, label]) => (
 *   <option key={status} value={status}>{label}</option>
 * ))
 * ```
 */
export function getAllUserFriendlyLabels(): Record<UserStatus, string> {
  return { ...UI_LABELS };
}
