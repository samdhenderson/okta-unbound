/**
 * @module sidepanel/components/shared/status
 * @description The single status/severity vocabulary shared by UI components (ADR-0002).
 *
 * Canonical values are `success | warning | danger | info`. This project uses
 * `danger`, NOT `error` — the legacy `'error'` alias has been fully migrated to
 * `'danger'` and removed. Consumed by e.g. `AlertMessage`.
 */

/** Canonical status/severity value used to drive component colour and iconography. */
export type StatusType = 'success' | 'warning' | 'danger' | 'info';
