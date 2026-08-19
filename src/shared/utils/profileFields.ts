/**
 * @module shared/utils/profileFields
 * @description Okta user-profile field partitioning for the Users tab.
 *
 * Splits a user's profile into the standard fields the UI renders explicitly and
 * the remaining "custom attributes". Critically, it filters out
 * {@link EXCLUDED_PROFILE_FIELDS} — security/recovery-question keys that must
 * never be surfaced in the UI. Extracted verbatim from `UsersTab`; any consumer
 * that renders custom attributes MUST route through {@link getCustomProfileFields}
 * so the security filter is applied.
 */

/** Security-sensitive profile field names that must never be rendered in the UI. */
export const EXCLUDED_PROFILE_FIELDS = new Set([
  'securityQuestion',
  'securityQuestionAnswer',
  'security_question',
  'security_answer',
  'recoveryQuestion',
  'recoveryAnswer',
  'password',
  'credentials',
]);

/**
 * Profile keys the Users tab already renders in dedicated sections (Account,
 * Organization, Contact, Preferences, identity header). Anything not in this set
 * — and not excluded — is treated as a custom attribute.
 */
export const STANDARD_PROFILE_FIELDS = new Set([
  'login',
  'email',
  'firstName',
  'lastName',
  'secondEmail',
  'mobilePhone',
  'primaryPhone',
  'streetAddress',
  'city',
  'state',
  'zipCode',
  'countryCode',
  'department',
  'title',
  'manager',
  'managerId',
  'division',
  'organization',
  'costCenter',
  'employeeNumber',
  'userType',
  'locale',
  'timezone',
  'genderPronouns',
]);

/**
 * Whether a profile key is {@link EXCLUDED_PROFILE_FIELDS security-sensitive} and
 * must never be surfaced in the UI. Matches both the raw and lower-cased key.
 * Single source of truth for the exclusion so every consumer (custom-attributes
 * and the "All attributes" view) stays in sync.
 *
 * @param key - The profile attribute name.
 */
export function isExcludedProfileField(key: string): boolean {
  return EXCLUDED_PROFILE_FIELDS.has(key) || EXCLUDED_PROFILE_FIELDS.has(key.toLowerCase());
}

/**
 * Return the non-standard, non-excluded, non-empty profile entries to render as
 * "Custom Attributes".
 *
 * @param profile - The user's Okta profile object.
 * @returns `[key, value]` pairs for every field that is not a standard field,
 *   not a {@link isExcludedProfileField security-sensitive} field, and whose
 *   value is not `null`/`undefined`/`''`.
 */
export function getCustomProfileFields(profile: Record<string, unknown>): Array<[string, unknown]> {
  return Object.entries(profile).filter(
    ([key, value]) =>
      !STANDARD_PROFILE_FIELDS.has(key) &&
      !isExcludedProfileField(key) &&
      value !== null &&
      value !== undefined &&
      value !== '',
  );
}

/**
 * Okta's base user-profile attributes, in the order Okta's own documentation
 * lists them.
 *
 * **Fallback only.** The authoritative list is the org's own schema
 * (`getUserProfileSchema` → `GET /api/v1/meta/schemas/user/default`), which also
 * carries human titles, types, and mutability, and is the only source that knows
 * about the org's *custom* attributes. Use this constant solely when that call
 * returns `null`, so the attribute inventory still shows every base attribute —
 * including the ones unset on the user being viewed — instead of collapsing to
 * whatever keys happen to be present on that one profile.
 *
 * Not filtered here: consumers must still run every key through
 * {@link isExcludedProfileField}.
 */
export const BASE_PROFILE_ATTRIBUTES: readonly string[] = [
  'login',
  'email',
  'secondEmail',
  'firstName',
  'lastName',
  'middleName',
  'honorificPrefix',
  'honorificSuffix',
  'displayName',
  'nickName',
  'profileUrl',
  'title',
  'userType',
  'department',
  'division',
  'organization',
  'costCenter',
  'employeeNumber',
  'manager',
  'managerId',
  'primaryPhone',
  'mobilePhone',
  'streetAddress',
  'city',
  'state',
  'zipCode',
  'countryCode',
  'postalAddress',
  'preferredLanguage',
  'locale',
  'timezone',
] as const;
