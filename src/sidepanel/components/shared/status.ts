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

/**
 * Badge variant for an Okta *user* status: the canonical {@link StatusType}
 * values plus `neutral` for dormant/unknown states (`STAGED`, unrecognized),
 * which render as an uncolored badge rather than an informational one.
 */
export type UserStatusVariant = StatusType | 'neutral';

/** The single status → variant decision, shared by every user-status badge. */
const USER_STATUS_VARIANTS: Record<string, UserStatusVariant> = {
  ACTIVE: 'success',
  PROVISIONED: 'info',
  STAGED: 'neutral',
  SUSPENDED: 'warning',
  RECOVERY: 'info',
  PASSWORD_EXPIRED: 'warning',
  LOCKED_OUT: 'danger',
  DEPROVISIONED: 'danger',
};

/**
 * Map an Okta user status to its badge variant.
 *
 * The one shared source of truth for user-status badge coloring (previously
 * three divergent per-component maps). Unknown statuses fall back to `neutral`.
 *
 * @param status - The raw Okta user status (e.g. `ACTIVE`, `LOCKED_OUT`).
 * @returns The canonical badge variant for that status.
 */
export function userStatusVariant(status: string): UserStatusVariant {
  return USER_STATUS_VARIANTS[status] ?? 'neutral';
}
