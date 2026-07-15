import type { OktaUser } from '../types';

/**
 * Display name for an Okta user.
 *
 * NOTE: not yet consolidated with `memberAnalytics.memberFullName`. That helper
 * falls back to `name || login || ''` whereas this one falls back to
 * `name || login || email || 'User'`. A naive swap changes rendered text, so
 * consolidation needs a fallback option on `memberFullName` — tracked in
 * refactoring-plan §5, not done here.
 */
export const userDisplayName = (user: OktaUser): string => {
  const name = `${user.profile.firstName || ''} ${user.profile.lastName || ''}`.trim();
  return name || user.profile.login || user.profile.email || 'User';
};

/** Two-letter initials for an avatar, from name then login/email, upper-cased. */
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
 * Stable hue (0–359) per user id so avatar colors are consistent across renders.
 * The exact arithmetic is a rendering contract for the avatar gradient — do not
 * "simplify" it.
 */
export const hueFromId = (id: string): number => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 360;
};
