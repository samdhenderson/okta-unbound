/**
 * @module sidepanel/components/users/profileAttributes
 * @description Builds the complete attribute inventory for one user — including the attributes that are empty on that user.
 *
 * No React and no I/O — safe to unit-test in isolation, like
 * {@link module:sidepanel/components/users/comparison/comparisonAnalytics}.
 *
 * The inventory is the union of three sources, because no single one is complete:
 * - the user's **top-level** lifecycle fields (`id`, `status`, the timestamps),
 *   which are not part of the profile object at all;
 * - the **org's schema** (`getUserProfileSchema`), which is the only source that
 *   knows an attribute exists when the user has no value for it, and the only
 *   source of human titles for custom attributes;
 * - the user's **own profile keys**, which catch anything the schema did not
 *   mention (a stale cached schema, an attribute added since, an org quirk). An
 *   unknown attribute must surface, never disappear.
 *
 * Where `userProfileSections.getAllFields` drops every empty value and hard-codes
 * its labels, this keeps the empty ones (flagged {@link AttributeDescriptor.isEmpty})
 * and takes labels from the schema — which is what "render, and let an admin
 * configure, every attribute" needs.
 *
 * Security: every candidate key — whatever its source — is filtered through
 * {@link isExcludedProfileField} before it is emitted, so a security/recovery-question
 * key can never reach the UI through this path.
 */
import type { OktaUser } from '../../../shared/types';
import type { OktaUserProfileSchema, OktaUserSchemaProperty } from '../../../shared/schemas/okta';
import { formatDateShort } from '../../../shared/utils/dateFormat';
import {
  BASE_PROFILE_ATTRIBUTES,
  isExcludedProfileField,
} from '../../../shared/utils/profileFields';

/**
 * Where an attribute comes from.
 *
 * - `system` — a top-level user field (`id`, `status`, lifecycle timestamps); not
 *   part of `user.profile` and not editable as a profile attribute.
 * - `base` — an Okta-defined profile attribute (`definitions.base`).
 * - `custom` — an org-defined profile attribute (`definitions.custom`), or a key
 *   present on the user's profile that the schema did not describe.
 */
export type AttributeKind = 'system' | 'base' | 'custom';

/** One attribute of a user's profile, present or not. */
export interface AttributeDescriptor {
  /** Stable key. Top-level fields use the bare name (`'id'`); profile fields use `'profile.<key>'`. */
  key: string;
  /** The attribute's own Okta name, without the `profile.` prefix — what a rule expression references. */
  name: string;
  /** Human label: the schema's `title` when present, else a humanized name. */
  label: string;
  /** Which of the three sources this attribute came from. */
  kind: AttributeKind;
  /** Stringified for display. `''` when unset. */
  value: string;
  /** The untouched value, so a future editor can round-trip a non-string attribute. */
  raw: unknown;
  /** `true` when the user has no value for this attribute — the row still renders. */
  isEmpty: boolean;
  /** Render the value in a monospace font (ids and similar). */
  mono?: boolean;
  /**
   * The attribute's schema property, when the org's schema described it.
   *
   * Carried rather than flattened because the editability gate reads four of its
   * fields (`mutability`, `master`, `type`, `enum`/`oneOf`, `required`) and a
   * flattened copy would need widening again for the fifth. Absent for `system`
   * attributes and for profile keys the schema never mentioned — and an attribute
   * we cannot describe is one we decline to edit.
   */
  property?: OktaUserSchemaProperty;
}

/**
 * Stringify an arbitrary attribute value for display; nullish and `''` collapse to `''`.
 *
 * Exported because three separate questions must be answered with the *same*
 * string or they will silently disagree: what the row renders, whether a draft
 * differs from the saved value, and whether the value in Okta is still the one we
 * wrote. Two stringifiers would disagree on `5` versus `'5'`, and the
 * disagreement would surface as an undo that refuses for no reason.
 */
export function toDisplay(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/**
 * Turn an attribute name into a fallback label: `secondEmail` → `Second Email`,
 * `employee_id` → `Employee Id`. Used only when the schema supplies no `title`
 * (or when there is no schema at all).
 *
 * @param name - The attribute's Okta name.
 */
function humanize(name: string): string {
  const spaced = name
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim();
  if (spaced === '') return name;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** A date-valued top-level field: formatted when set, `''` when the user has none. */
function displayDate(value: string | null | undefined): string {
  return value ? formatDateShort(value) : '';
}

/**
 * The Okta user-type object (`user.type`) reduced to something displayable.
 * Okta embeds `{ id }` on the user; anything else is stringified as-is.
 */
function displayUserType(value: unknown): string {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    if (typeof record.name === 'string') return record.name;
    if (typeof record.id === 'string') return record.id;
  }
  return toDisplay(value);
}

/** The top-level (non-profile) fields, in the order the inventory lists them. */
function systemAttributes(user: OktaUser): AttributeDescriptor[] {
  // `type` is not on the `OktaUser` interface — Okta returns it, so read it
  // defensively rather than widening the shared domain type.
  const rawType = (user as OktaUser & { type?: unknown }).type;

  const rows: Array<{ name: string; label: string; value: string; raw: unknown; mono?: boolean }> =
    [
      { name: 'id', label: 'User ID', value: toDisplay(user.id), raw: user.id, mono: true },
      { name: 'status', label: 'Status', value: toDisplay(user.status), raw: user.status },
      { name: 'type', label: 'Type', value: displayUserType(rawType), raw: rawType },
      { name: 'created', label: 'Created', value: displayDate(user.created), raw: user.created },
      {
        name: 'activated',
        label: 'Activated',
        value: displayDate(user.activated),
        raw: user.activated,
      },
      {
        name: 'statusChanged',
        label: 'Status Changed',
        value: displayDate(user.statusChanged),
        raw: user.statusChanged,
      },
      {
        name: 'lastLogin',
        label: 'Last Login',
        value: displayDate(user.lastLogin),
        raw: user.lastLogin,
      },
      {
        name: 'lastUpdated',
        label: 'Last Updated',
        value: displayDate(user.lastUpdated),
        raw: user.lastUpdated,
      },
      {
        name: 'passwordChanged',
        label: 'Password Changed',
        value: displayDate(user.passwordChanged),
        raw: user.passwordChanged,
      },
    ];

  return rows.map((row) => ({
    key: row.name,
    name: row.name,
    label: row.label,
    kind: 'system' as const,
    value: row.value,
    raw: row.raw,
    isEmpty: row.value === '',
    ...(row.mono ? { mono: true } : {}),
  }));
}

/** The `{ properties }` map of one schema definition block, or `{}` when absent. */
function definitionProperties(
  schema: OktaUserProfileSchema | null,
  block: 'base' | 'custom',
): Record<string, OktaUserSchemaProperty> {
  return schema?.definitions?.[block]?.properties ?? {};
}

/** Build one profile-attribute descriptor from a name plus its (optional) schema property. */
function profileAttribute(
  user: OktaUser,
  name: string,
  kind: AttributeKind,
  property?: OktaUserSchemaProperty,
): AttributeDescriptor {
  const raw = user.profile?.[name];
  const value = toDisplay(raw);
  return {
    key: `profile.${name}`,
    name,
    label: property?.title || humanize(name),
    kind,
    value,
    raw,
    isEmpty: value === '',
    property,
  };
}

/**
 * Every attribute of a user's profile — the ones with values and the ones without.
 *
 * @param user - The user being viewed.
 * @param schema - The org's profile schema from `getUserProfileSchema`, or `null`
 *   when that call failed. `null` falls back to {@link BASE_PROFILE_ATTRIBUTES}
 *   for the base set; custom attributes are then only discoverable from the keys
 *   this user actually carries.
 * @returns Descriptors ordered system → base → custom → unmentioned profile keys.
 *   Each key appears exactly once, and every key has passed
 *   {@link isExcludedProfileField}. Empty attributes are included with
 *   `isEmpty: true` — dropping them is what made the previous "all attributes"
 *   view unable to answer "does this org define X?".
 *
 * @example
 * const rows = allProfileAttributes(user, schema);
 * const unset = rows.filter((r) => r.isEmpty);
 */
export function allProfileAttributes(
  user: OktaUser,
  schema: OktaUserProfileSchema | null,
): AttributeDescriptor[] {
  const attributes: AttributeDescriptor[] = [];
  // Guards both "already emitted" and the security filter in one pass, so no
  // source can re-introduce a key another source dropped.
  const seen = new Set<string>();

  const emit = (descriptor: AttributeDescriptor): void => {
    if (seen.has(descriptor.key)) return;
    // Every candidate, whatever its source, is checked by name (the bare Okta
    // attribute name) — never the prefixed key, which would defeat the match.
    if (isExcludedProfileField(descriptor.name)) return;
    seen.add(descriptor.key);
    attributes.push(descriptor);
  };

  for (const attribute of systemAttributes(user)) emit(attribute);

  const baseProperties = definitionProperties(schema, 'base');
  const schemaBaseNames = Object.keys(baseProperties);
  // The static list also covers a schema that parsed but carries no base block —
  // the base attributes exist in the org either way, so never emit zero of them.
  const baseNames = schemaBaseNames.length > 0 ? schemaBaseNames : BASE_PROFILE_ATTRIBUTES;
  for (const name of baseNames) {
    emit(profileAttribute(user, name, 'base', baseProperties[name]));
  }

  const customProperties = definitionProperties(schema, 'custom');
  for (const [name, property] of Object.entries(customProperties)) {
    emit(profileAttribute(user, name, 'custom', property));
  }

  // Anything on this user's profile the schema never mentioned. Classified
  // `custom` and listed last: an attribute we cannot describe must still be
  // visible, because the alternative is an admin looking at an incomplete
  // profile with no signal that it is incomplete.
  for (const name of Object.keys(user.profile ?? {})) {
    emit(profileAttribute(user, name, 'custom'));
  }

  return attributes;
}
