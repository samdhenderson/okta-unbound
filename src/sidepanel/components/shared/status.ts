/**
 * The single status/severity vocabulary for UI components (ADR-0002).
 *
 * Canonical values are `success | warning | danger | info`. The legacy `'error'`
 * alias has been fully migrated to `'danger'` and removed.
 *
 * @module status
 */

export type StatusType = 'success' | 'warning' | 'danger' | 'info';
