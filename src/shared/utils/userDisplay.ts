/**
 * @module shared/utils/userDisplay
 * @description Presentation helpers for rendering an Okta user: display name,
 * avatar initials, and a stable avatar hue.
 */

import type { OktaUser } from '../types';

/**
 * Display name for an Okta user: "First Last", falling back to login, then email,
 * then the literal `'User'`.
 *
 * NOTE: not yet consolidated with `memberAnalytics.memberFullName`. That helper
 * falls back to `name || login || ''` whereas this one falls back to
 * `name || login || email || 'User'`. A naive swap changes rendered text, so
 * consolidation needs a fallback option on `memberFullName` — tracked in
 * refactoring-plan §5, not done here.
 *
 * @param user - The Okta user.
 * @returns A non-empty display string.
 */
export const userDisplayName = (user: OktaUser): string => {
  const name = `${user.profile.firstName || ''} ${user.profile.lastName || ''}`.trim();
  return name || user.profile.login || user.profile.email || 'User';
};

/**
 * Two-letter initials for an avatar, derived from first/last name, else the first
 * two characters of login/email, upper-cased.
 *
 * @param user - The Okta user.
 * @returns Up to two upper-cased characters; `'?'` when no source is available.
 */
export const initialsOf = (user: OktaUser): string => {
  const first = (user.profile.firstName || '').trim();
  const last = (user.profile.lastName || '').trim();
  if (first || last) {
    return `${first[0] || ''}${last[0] || ''}`.toUpperCase() || '?';
  }
  const fallback = user.profile.login || user.profile.email || '?';
  return fallback.slice(0, 2).toUpperCase();
};

/**
 * Deterministic hue (0–359) derived from a user id, so avatar colors stay
 * consistent across renders. Uses a `* 31` rolling hash mod 360.
 *
 * The exact arithmetic is a rendering contract for the avatar gradient — do not
 * "simplify" it.
 *
 * @param id - The Okta user id.
 * @returns An integer hue in the range 0–359.
 */
export const hueFromId = (id: string): number => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 360;
};
