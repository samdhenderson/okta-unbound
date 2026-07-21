/**
 * @module sidepanel/components/users/userProfileSections
 * @description Partitions an Okta user into the labelled sections the profile tabs render.
 *
 * Keeps field selection/formatting out of {@link UserProfileCard}. Each getter
 * returns display-ready {@link ProfileField} rows; empty rows are dropped so a
 * section with no data can self-hide. {@link getAllFields} is the flat,
 * searchable "All attributes" view and, like {@link getCustomProfileFields},
 * enforces the {@link isExcludedProfileField} security filter.
 */
import type { OktaUser } from '../../../shared/types';
import { formatDateShort } from '../../../shared/utils/dateFormat';
import {
  getCustomProfileFields,
  isExcludedProfileField,
} from '../../../shared/utils/profileFields';

/** One display-ready profile row. */
export interface ProfileField {
  /** Stable key (React key + the searchable attribute name in the All view). */
  key: string;
  /** Human label. */
  label: string;
  /** Pre-stringified display value (never empty for rendered rows). */
  value: string;
  /** Render the value in a monospace font (ids and similar). */
  mono?: boolean;
}

/** Stringify an arbitrary profile value for display. */
const toDisplay = (value: unknown): string =>
  value === null || value === undefined
    ? ''
    : typeof value === 'object'
      ? JSON.stringify(value)
      : String(value);

/** Drop rows whose value is empty. */
const compact = (fields: ProfileField[]): ProfileField[] => fields.filter((f) => f.value !== '');

/** Account/lifecycle fields (always available — at minimum Login + User ID). */
export function getAccountFields(user: OktaUser): ProfileField[] {
  return compact([
    { key: 'login', label: 'Login', value: toDisplay(user.profile.login) },
    { key: 'id', label: 'User ID', value: user.id, mono: true },
    { key: 'secondEmail', label: 'Secondary Email', value: toDisplay(user.profile.secondEmail) },
    {
      key: 'activated',
      label: 'Activated',
      value: user.activated ? formatDateShort(user.activated) : '',
    },
    {
      key: 'statusChanged',
      label: 'Status Changed',
      value: user.statusChanged ? formatDateShort(user.statusChanged) : '',
    },
    {
      key: 'passwordChanged',
      label: 'Password Changed',
      value: user.passwordChanged ? formatDateShort(user.passwordChanged) : '',
    },
    {
      key: 'lastUpdated',
      label: 'Profile Updated',
      value: user.lastUpdated ? formatDateShort(user.lastUpdated) : '',
    },
  ]);
}

/** Organization fields (self-hides when empty). */
export function getOrgFields(user: OktaUser): ProfileField[] {
  const p = user.profile;
  return compact([
    { key: 'title', label: 'Title', value: toDisplay(p.title) },
    { key: 'department', label: 'Department', value: toDisplay(p.department) },
    { key: 'division', label: 'Division', value: toDisplay(p.division) },
    { key: 'organization', label: 'Organization', value: toDisplay(p.organization) },
    { key: 'manager', label: 'Manager', value: toDisplay(p.manager) },
    { key: 'costCenter', label: 'Cost Center', value: toDisplay(p.costCenter) },
    { key: 'employeeNumber', label: 'Employee #', value: toDisplay(p.employeeNumber) },
    { key: 'userType', label: 'User Type', value: toDisplay(p.userType) },
  ]);
}

/** Contact fields (self-hides when empty). Address is composed from its parts. */
export function getContactFields(user: OktaUser): ProfileField[] {
  const p = user.profile;
  const address = [p.streetAddress, p.city, p.state, p.zipCode, p.countryCode]
    .filter(Boolean)
    .join(', ');
  return compact([
    { key: 'primaryPhone', label: 'Phone', value: toDisplay(p.primaryPhone) },
    { key: 'mobilePhone', label: 'Mobile', value: toDisplay(p.mobilePhone) },
    { key: 'address', label: 'Address', value: address },
  ]);
}

/** Preference fields (self-hides when empty). */
export function getPrefsFields(user: OktaUser): ProfileField[] {
  const p = user.profile;
  return compact([
    { key: 'locale', label: 'Locale', value: toDisplay(p.locale) },
    { key: 'timezone', label: 'Timezone', value: toDisplay(p.timezone) },
  ]);
}

/** Custom (org-defined) attributes, security-filtered via {@link getCustomProfileFields}. */
export function getCustomFields(user: OktaUser): ProfileField[] {
  return getCustomProfileFields(user.profile).map(([key, value]) => ({
    key,
    label: key,
    value: toDisplay(value),
  }));
}

/** Top-level (non-`profile`) user fields surfaced by name in the All view. */
const TOP_LEVEL_DATE_FIELDS: Array<keyof OktaUser> = [
  'created',
  'activated',
  'statusChanged',
  'lastLogin',
  'lastUpdated',
  'passwordChanged',
];

/**
 * Flat, alphabetically-sorted list of every attribute (top-level + profile),
 * excluding security-sensitive keys. The searchable "All attributes" source of
 * truth. Date-typed top-level fields are formatted for readability.
 */
export function getAllFields(user: OktaUser): ProfileField[] {
  const rows: ProfileField[] = [
    { key: 'id', label: 'id', value: user.id, mono: true },
    { key: 'status', label: 'status', value: toDisplay(user.status) },
  ];

  for (const field of TOP_LEVEL_DATE_FIELDS) {
    const raw = user[field] as string | null | undefined;
    if (raw) rows.push({ key: field, label: field, value: formatDateShort(raw) });
  }

  for (const [key, value] of Object.entries(user.profile)) {
    if (isExcludedProfileField(key)) continue;
    const display = toDisplay(value);
    if (display === '') continue;
    rows.push({ key: `profile.${key}`, label: key, value: display });
  }

  return rows.sort((a, b) => a.label.localeCompare(b.label));
}
