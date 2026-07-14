/**
 * The single status/severity vocabulary for UI components (ADR-0002).
 *
 * Canonical values are `success | warning | danger | info`. `'error'` is a
 * deprecated alias for `'danger'` retained only so existing call sites keep
 * working during the codemod; do not use it in new code.
 *
 * @module status
 */

export type StatusType = 'success' | 'warning' | 'danger' | 'info';

/** Includes the deprecated `'error'` alias for backwards compatibility. */
export type StatusTypeWithLegacy = StatusType | 'error';

/** Normalize the legacy `'error'` value to the canonical `'danger'`. */
export function normalizeStatus(type: StatusTypeWithLegacy): StatusType {
  return type === 'error' ? 'danger' : type;
}
