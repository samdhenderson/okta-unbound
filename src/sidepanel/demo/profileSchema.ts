/**
 * @module sidepanel/demo/profileSchema
 * @description The demo org's user profile schema, as Okta would answer
 * `GET /api/v1/meta/schemas/user/default`.
 *
 * ## Why the demo org needs one at all
 *
 * The Profile pane's edit gate is deny-by-default (`profileEditability`): an
 * attribute the schema does not describe is locked with "the org's profile
 * schema does not describe this attribute". The story mock answered `null` for
 * the schema, so **every** attribute of every demo user was locked and the
 * `Edit` button never appeared. Nothing was broken; the panel was correctly
 * refusing to write to an org it had been told nothing about.
 *
 * That is fine for a scene that only reads. It is fatal for the Users chapter,
 * whose whole argument is that a mis-typed attribute is a thing you can see and
 * then correct, so the schema is fixture data now rather than an absence.
 *
 * ## Mastering is `OKTA`, deliberately and truthfully
 *
 * Every property here declares `master: { type: 'OKTA' }`. The alternative,
 * `PROFILE_MASTER`, unlocks only once the user's app walk has *completed* and
 * found no profile source, which would make the chapter's central affordance
 * depend on a race the camera cannot see. It would also be a lie about this
 * org: no demo app carries `features: ['PROFILE_MASTERING']`, so there is no
 * profile source here to defer to. `OKTA` is what this org actually is.
 *
 * `login` is the exception and stays locked on camera - not by anything here,
 * but by the account-mastering check, which finds no `credentials.provider` on
 * a demo user and refuses on those grounds. That refusal is worth having
 * visible: it is the gate declining to guess.
 *
 * Security: fake org data only. No real attribute names beyond Okta's own
 * documented base set, no values, no org identifiers.
 */
import type { OktaUserProfileSchema, OktaUserSchemaProperty } from '../../shared/schemas/okta';

/** A writable string attribute, mastered by Okta. The shape most of the base set takes. */
const text = (title: string, required = false): OktaUserSchemaProperty => ({
  title,
  type: 'string',
  mutability: 'READ_WRITE',
  required,
  master: { type: 'OKTA' },
});

/** A writable attribute with a fixed set of labelled values. Renders as a select. */
const choice = (title: string, values: readonly string[]): OktaUserSchemaProperty => ({
  title,
  type: 'string',
  mutability: 'READ_WRITE',
  required: false,
  enum: [...values],
  master: { type: 'OKTA' },
});

/**
 * Okta's base profile attributes, as this org defines them.
 *
 * A subset rather than all thirty-one of `BASE_PROFILE_ATTRIBUTES`: an org that
 * has never populated `honorificSuffix` still has it in the schema, but a demo
 * whose Profile pane is thirty rows of blanks reads as an empty account rather
 * than a described one. The ones here are the ones demo users carry, plus
 * `manager` and `mobilePhone`, which are empty on purpose - an attribute the
 * org defines and nobody filled in is a real state and the pane distinguishes
 * it from one the schema never mentioned.
 */
const BASE: Record<string, OktaUserSchemaProperty> = {
  login: {
    title: 'Username',
    type: 'string',
    mutability: 'READ_WRITE',
    required: true,
    master: { type: 'OKTA' },
  },
  email: text('Primary email', true),
  secondEmail: text('Secondary email'),
  firstName: text('First name', true),
  lastName: text('Last name', true),
  displayName: text('Display name'),
  title: text('Title'),
  userType: text('User type'),
  department: text('Department'),
  organization: text('Organization'),
  manager: text('Manager'),
  mobilePhone: text('Mobile phone'),
  city: text('City'),
  state: text('State'),
  countryCode: choice('Country code', ['US', 'GB', 'DE', 'IE', 'CA', 'AU']),
};

/**
 * The org's own attributes.
 *
 * `employeeType` is not in Okta's base set - it is one an org adds - and the
 * demo org's rules key on it (`RULE_FED`'s contractor exclusions), which makes
 * it the right one to carry the custom block. Declared as a choice so the pane
 * renders a select and the difference between "typed freely" and "picked from
 * the org's list" is on camera beside `department`, which is typed freely and
 * is exactly how the chapter's typo happened.
 */
const CUSTOM: Record<string, OktaUserSchemaProperty> = {
  employeeType: choice('Employee type', ['FULL_TIME', 'PART_TIME', 'CONTRACTOR', 'INTERN']),
};

/** The whole schema, in the shape `oktaUserProfileSchemaSchema` validates. */
export const DEMO_USER_PROFILE_SCHEMA: OktaUserProfileSchema = {
  id: 'https://example.okta.com/meta/schemas/user/default',
  name: 'user',
  definitions: {
    base: { id: '#base', type: 'object', properties: BASE, required: ['login'] },
    custom: { id: '#custom', type: 'object', properties: CUSTOM, required: [] },
  },
};
