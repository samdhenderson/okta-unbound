/**
 * @module sidepanel/components/users/profileDisplayStoryFixture
 * @description The one profile every customize-mode story and test is built on.
 *
 * Shared rather than copied because the fixture is *deliberately interleaved* —
 * the two Identity attributes are separated in `attrOrder` by an uncategorized
 * one — so a reorder that swapped with the visual neighbour instead of the
 * section neighbour cannot pass anywhere. A per-file copy would drift out of
 * that shape within a change or two.
 *
 * Security: every value here is a placeholder. No real org URL, id, or address
 * appears in this repo, including in fixtures.
 */
import {
  DEFAULT_PROFILE_DISPLAY_CONFIG,
  type ProfileDisplayConfig,
} from '../../../shared/storage/profileDisplayStore';
import type { AttributeDescriptor } from './profileAttributes';

/**
 * One attribute descriptor, with the noise a story does not care about defaulted.
 *
 * @param name - The attribute's Okta name.
 * @param kind - Where the attribute comes from.
 * @param value - Its stringified value; `''` marks it empty on this user.
 * @param label - Its human label; defaults to the name.
 */
export function fixtureAttribute(
  name: string,
  kind: AttributeDescriptor['kind'],
  value: string,
  label = name,
): AttributeDescriptor {
  return {
    key: kind === 'system' ? name : `profile.${name}`,
    name,
    label,
    kind,
    value,
    raw: value,
    isEmpty: value === '',
  };
}

/** Five attributes: two Identity, one Organization, two uncategorized, one empty. */
export const fixtureAttributes: AttributeDescriptor[] = [
  fixtureAttribute('login', 'base', 'ada@example.com', 'Username'),
  fixtureAttribute('lastName', 'base', 'Lovelace', 'Last name'),
  fixtureAttribute('firstName', 'base', 'Ada', 'First name'),
  fixtureAttribute('department', 'custom', '', 'Department'),
  fixtureAttribute('id', 'system', '00uFAKE0001', 'Okta ID'),
];

/** A reconciled config over {@link fixtureAttributes}, with complete maps. */
export const fixtureConfig: ProfileDisplayConfig = {
  ...DEFAULT_PROFILE_DISPLAY_CONFIG,
  showEmpty: true,
  categories: [
    { key: 'identity', name: 'Identity' },
    { key: 'organization', name: 'Organization' },
  ],
  attrOrder: ['login', 'lastName', 'firstName', 'department', 'id'],
  assign: {
    login: 'identity',
    lastName: '',
    firstName: 'identity',
    department: 'organization',
    id: '',
  },
  hidden: {
    login: false,
    lastName: false,
    firstName: false,
    department: false,
    id: false,
  },
};
