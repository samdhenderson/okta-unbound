/**
 * @module sidepanel/components/policies/policyStatus
 * @description Shared badge styling for a policy / policy-rule lifecycle status.
 *
 * Policies and their rules use the same `ACTIVE` / `INACTIVE` lifecycle, so the
 * Auth Policies cards and the nested rules list share one decision here rather
 * than each growing its own colour map. Uses the design-system token classes only
 * (no raw hex) and the canonical status vocabulary (ADR-0002).
 */

/**
 * Badge classes for a policy or rule status.
 *
 * @param status - The raw Okta status (`'ACTIVE'`, `'INACTIVE'`, or anything else
 *   the API may return; the value is untrusted and used only for this lookup).
 * @returns Token-based Tailwind classes: success styling for `ACTIVE`, neutral
 *   styling for every other (or missing) value.
 */
export function policyStatusClasses(status?: string): string {
  return status === 'ACTIVE'
    ? 'bg-success-light text-success-text border-success-light'
    : 'bg-neutral-50 text-neutral-600 border-neutral-200';
}

/**
 * Display label for a policy or rule status.
 *
 * @param status - The raw Okta status.
 * @returns The status verbatim, or `'UNKNOWN'` when the field is absent.
 */
export function policyStatusLabel(status?: string): string {
  return status ?? 'UNKNOWN';
}
