import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  oktaUserSchema,
  oktaGroupSchema,
  oktaUserListItemSchema,
  oktaGroupListItemSchema,
  oktaAppUserSchema,
  oktaAppListItemSchema,
  oktaAppGroupSchema,
  extractAppAssignmentScope,
  extractAppGrantGroupId,
  isProfileSourceApp,
  oktaPolicyListItemSchema,
  oktaPolicyRuleSchema,
  parseOkta,
  parseOktaList,
} from './okta';

const validUser = {
  id: '00u1abcdefghijklmno',
  status: 'ACTIVE',
  profile: {
    login: 'jane@acme.com',
    email: 'jane@acme.com',
    firstName: 'Jane',
    lastName: 'Doe',
    // org-extended attribute not in the known set — must be allowed through
    customBadgeId: 'X-4412',
  },
};

describe('oktaUserSchema / parseOkta', () => {
  it('accepts a valid user and preserves extra profile attributes', () => {
    const user = parseOkta(oktaUserSchema, validUser, 'test');
    expect(user.profile.email).toBe('jane@acme.com');
    expect((user.profile as Record<string, unknown>).customBadgeId).toBe('X-4412');
  });

  it('rejects an unknown status value', () => {
    const bad = { ...validUser, status: 'NOT_A_STATUS' };
    expect(() => parseOkta(oktaUserSchema, bad, 'test')).toThrow(/validation failed/);
  });

  it('rejects a payload missing required profile fields', () => {
    const bad = { id: '00u1', status: 'ACTIVE', profile: { login: 'x' } };
    expect(() => parseOkta(oktaUserSchema, bad, 'test')).toThrow(/validation failed/);
  });

  it('reports issue paths and codes but never the offending (potentially PII) value', () => {
    // status is an enum over a value; the received value must NOT appear in the error.
    const offendingValue = '00gFAKE-SECRET-STATUS';
    const bad = { ...validUser, status: offendingValue };

    let message = '';
    try {
      parseOkta(oktaUserSchema, bad, 'GET /users/{id}');
    } catch (err) {
      message = (err as Error).message;
    }

    // paths + codes are surfaced for debugging…
    expect(message).toContain('"path":"status"');
    expect(message).toContain('"code":"invalid_enum_value"');
    // …but the received value is never echoed (no PII leak).
    expect(message).not.toContain(offendingValue);
  });
});

describe('oktaGroupSchema', () => {
  it('accepts a group with id and profile.name', () => {
    const group = parseOkta(
      oktaGroupSchema,
      { id: '00g1', profile: { name: 'Engineering', description: null } },
      'test',
    );
    expect(group.profile.name).toBe('Engineering');
  });

  it('rejects a group missing profile.name', () => {
    const bad = { id: '00g1', profile: { description: 'x' } };
    expect(() => parseOkta(oktaGroupSchema, bad, 'test')).toThrow(/validation failed/);
  });

  it('surfaces the context in the error message', () => {
    expect(() => parseOkta(oktaGroupSchema, { id: 1 }, 'GET /groups/{id}')).toThrow(
      /GET \/groups\/\{id\}/,
    );
  });
});

describe('oktaAppUserSchema', () => {
  it('accepts a minimal row (only id required) and preserves unknown fields', () => {
    const parsed = oktaAppUserSchema.parse({ id: '00uFAKE1', orgSpecific: 'kept' });
    expect(parsed.id).toBe('00uFAKE1');
    expect((parsed as Record<string, unknown>).orgSpecific).toBe('kept');
  });

  it('accepts an assignment carrying embedded credentials and surfaces userName', () => {
    const parsed = oktaAppUserSchema.parse({
      id: '00uFAKE1',
      status: 'ACTIVE',
      scope: 'USER',
      syncState: 'SYNCED',
      created: null,
      credentials: { userName: 'user@example.com', extra: true },
    });
    expect(parsed.credentials?.userName).toBe('user@example.com');
    expect(parsed.scope).toBe('USER');
  });

  it('rejects a row without an id', () => {
    expect(oktaAppUserSchema.safeParse({ status: 'ACTIVE' }).success).toBe(false);
  });
});

describe('oktaAppGroupSchema', () => {
  it('accepts a minimal row (only id required)', () => {
    const parsed = oktaAppGroupSchema.parse({ id: '00gFAKE1', priority: 1 });
    expect(parsed.id).toBe('00gFAKE1');
    expect(parsed.priority).toBe(1);
  });

  it('accepts a generic profile and nullish lastUpdated, preserving unknown fields', () => {
    const parsed = oktaAppGroupSchema.parse({
      id: '00gFAKE1',
      lastUpdated: null,
      profile: { anything: 'goes' },
      _links: { group: { href: 'https://example.okta.com/api/v1/groups/00gFAKE1' } },
    });
    expect(parsed.lastUpdated).toBeNull();
    expect(parsed.profile).toEqual({ anything: 'goes' });
    expect((parsed as Record<string, unknown>)._links).toBeDefined();
  });

  it('rejects a row without an id', () => {
    expect(oktaAppGroupSchema.safeParse({ priority: 0 }).success).toBe(false);
  });
});

describe('oktaPolicyListItemSchema', () => {
  it('accepts a minimal row (only id required)', () => {
    const parsed = oktaPolicyListItemSchema.parse({ id: 'rstFAKEpolicy00000001' });
    expect(parsed.id).toBe('rstFAKEpolicy00000001');
    expect(parsed.name).toBeUndefined();
    expect(parsed.priority).toBeUndefined();
  });

  it('accepts the full known shape, including nullish dates and description', () => {
    const parsed = oktaPolicyListItemSchema.parse({
      id: 'rstFAKEpolicy00000001',
      name: 'Any two factors',
      status: 'ACTIVE',
      type: 'ACCESS_POLICY',
      priority: 1,
      description: null,
      system: false,
      created: '2026-01-01T00:00:00.000Z',
      lastUpdated: null,
    });
    expect(parsed.type).toBe('ACCESS_POLICY');
    expect(parsed.description).toBeNull();
    expect(parsed.system).toBe(false);
  });

  it('preserves _links and unknown fields via passthrough (never strips them)', () => {
    const parsed = oktaPolicyListItemSchema.parse({
      id: 'rstFAKEpolicy00000001',
      _links: { rules: { href: 'https://example.okta.com/api/v1/policies/x/rules' } },
      conditions: { people: { groups: { include: [] } } },
      someFutureOktaField: 'kept',
    });
    expect(parsed._links).toEqual({
      rules: { href: 'https://example.okta.com/api/v1/policies/x/rules' },
    });
    expect((parsed as Record<string, unknown>).conditions).toEqual({
      people: { groups: { include: [] } },
    });
    expect((parsed as Record<string, unknown>).someFutureOktaField).toBe('kept');
  });

  it('rejects a row without an id', () => {
    expect(oktaPolicyListItemSchema.safeParse({ name: 'no id' }).success).toBe(false);
  });

  it('drops id-less rows through parseOktaList but keeps the valid ones', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const policies = parseOktaList(
      oktaPolicyListItemSchema,
      [{ name: 'no id' }, 'not-an-object', { id: 'rstFAKEpolicy00000002' }],
      'GET /api/v1/policies',
    );
    expect(policies).toHaveLength(1);
    expect(policies[0].id).toBe('rstFAKEpolicy00000002');
    vi.restoreAllMocks();
  });
});

describe('oktaPolicyRuleSchema', () => {
  it('accepts a minimal rule (only id required)', () => {
    const parsed = oktaPolicyRuleSchema.parse({ id: 'rulFAKErule000000001' });
    expect(parsed.id).toBe('rulFAKErule000000001');
    expect(parsed.conditions).toBeUndefined();
    expect(parsed.actions).toBeUndefined();
  });

  it('keeps conditions/actions verbatim regardless of their (per-type) deep shape', () => {
    const parsed = oktaPolicyRuleSchema.parse({
      id: 'rulFAKErule000000001',
      name: 'Catch-all',
      status: 'ACTIVE',
      priority: 1,
      system: true,
      conditions: { network: { connection: 'ANYWHERE' }, elCondition: { condition: 'true' } },
      actions: { appSignOn: { access: 'ALLOW', verificationMethod: { factorMode: '2FA' } } },
      unknownFutureField: 'kept',
    });
    expect(parsed.conditions).toEqual({
      network: { connection: 'ANYWHERE' },
      elCondition: { condition: 'true' },
    });
    expect(parsed.actions).toEqual({
      appSignOn: { access: 'ALLOW', verificationMethod: { factorMode: '2FA' } },
    });
    expect((parsed as Record<string, unknown>).unknownFutureField).toBe('kept');
  });

  it('rejects a rule without an id', () => {
    expect(oktaPolicyRuleSchema.safeParse({ name: 'no id' }).success).toBe(false);
  });
});

const validListUser = {
  id: '00uFAKEuser000000001',
  status: 'ACTIVE',
  profile: {
    login: 'user@example.com',
    email: 'user@example.com',
    firstName: 'Test',
    lastName: 'User',
  },
};

const validListGroup = {
  id: '00gFAKEgroup00000001',
  type: 'OKTA_GROUP',
  profile: { name: 'Engineering', description: null },
};

describe('parseOktaList', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('validates every item of a well-formed array', () => {
    const users = parseOktaList(
      oktaUserListItemSchema,
      [validListUser, { ...validListUser, id: '00uFAKEuser000000002' }],
      'test',
    );
    expect(users).toHaveLength(2);
    expect(users[0].profile.email).toBe('user@example.com');
  });

  it('drops a malformed item, keeps the valid ones, and counts the drop once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const badUser = { id: '00uFAKEuser000000003', status: 'NOT_A_STATUS', profile: {} };

    const users = parseOktaList(oktaUserListItemSchema, [validListUser, badUser], 'GET /users?q');

    // The valid item survives; the malformed one is dropped (degrade, not throw).
    expect(users).toHaveLength(1);
    expect(users[0].id).toBe('00uFAKEuser000000001');

    // Exactly one warning, carrying counts only — never field values / PII.
    expect(warn).toHaveBeenCalledTimes(1);
    const logged = JSON.stringify(warn.mock.calls[0]);
    expect(logged).toContain('"context":"GET /users?q"');
    expect(logged).toContain('"dropped":1');
    expect(logged).toContain('"total":2');
    expect(logged).not.toContain('NOT_A_STATUS');
  });

  it('returns [] and warns (no values) when data is not an array', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(parseOktaList(oktaUserListItemSchema, { aaData: [] }, 'GET /users?q')).toEqual([]);
    expect(parseOktaList(oktaUserListItemSchema, null, 'GET /users?q')).toEqual([]);
    expect(parseOktaList(oktaUserListItemSchema, undefined, 'GET /users?q')).toEqual([]);

    expect(warn).toHaveBeenCalledTimes(3);
    const logged = JSON.stringify(warn.mock.calls[0]);
    expect(logged).toContain('"code":"not_an_array"');
  });

  it('does not warn when nothing is dropped', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    parseOktaList(oktaUserListItemSchema, [validListUser], 'test');
    expect(warn).not.toHaveBeenCalled();
  });

  it('preserves org-extended user attributes via passthrough', () => {
    const [user] = parseOktaList(
      oktaUserListItemSchema,
      [{ ...validListUser, profile: { ...validListUser.profile, customBadgeId: 'X-4412' } }],
      'test',
    );
    expect((user.profile as Record<string, unknown>).customBadgeId).toBe('X-4412');
  });

  it('keeps group type and unknown fields (member counts) that the single-object schema strips', () => {
    const [group] = parseOktaList(
      oktaGroupListItemSchema,
      [{ ...validListGroup, type: 'APP_GROUP', _embedded: { stats: { usersCount: 42 } } }],
      'test',
    );
    // type must survive so APP_GROUP is not misclassified as a plain group…
    expect(group.type).toBe('APP_GROUP');
    // …and passthrough keeps the embedded stats used for member counts.
    expect((group as Record<string, unknown>)._embedded).toEqual({ stats: { usersCount: 42 } });
    // null description is normalized to undefined to match the OktaGroup domain type.
    expect(group.profile?.description).toBeUndefined();
  });

  it('is lenient: a minimal group with only an id survives (conservative degrade)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const groups = parseOktaList(oktaGroupListItemSchema, [{ id: '00gFAKEgroup00000009' }], 'test');
    expect(groups).toEqual([{ id: '00gFAKEgroup00000009' }]);
    // Nothing dropped → no warning.
    expect(warn).not.toHaveBeenCalled();
  });

  it('drops genuinely malformed rows (non-object / missing id) but keeps the rest', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const groups = parseOktaList(
      oktaGroupListItemSchema,
      [validListGroup, 'not-an-object', { profile: { name: 'no id here' } }],
      'test',
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].id).toBe(validListGroup.id);
  });
});

/**
 * `expand=user/{userId}` on `GET /api/v1/apps` embeds the app-user under
 * `_embedded.user`, carrying the assignment `scope`. The schema deliberately
 * leaves `_embedded` as `z.unknown()` so no embed shape can make `parseOktaList`
 * drop the app; `extractAppAssignmentScope` does the validation on read.
 */
describe('app-assignment scope (_embedded on oktaAppListItemSchema)', () => {
  it('never drops an app row over its _embedded value, whatever shape it has', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const rows = [
      { id: '0oaFAKE1', label: 'One', _embedded: { user: { id: '00uFAKE1', scope: 'USER' } } },
      { id: '0oaFAKE2', label: 'Two' },
      { id: '0oaFAKE3', label: 'Three', _embedded: 'nonsense' },
      { id: '0oaFAKE4', label: 'Four', _embedded: null },
      { id: '0oaFAKE5', label: 'Five', _embedded: { user: 42 } },
    ];

    const apps = parseOktaList(oktaAppListItemSchema, rows, 'test');

    // Under-reporting a user's access is worse than a missing scope: every row survives.
    expect(apps.map((a) => a.id)).toEqual([
      '0oaFAKE1',
      '0oaFAKE2',
      '0oaFAKE3',
      '0oaFAKE4',
      '0oaFAKE5',
    ]);
    // The embed is reachable from TypeScript now (typed `unknown`), not stripped.
    expect(apps[0]._embedded).toEqual({ user: { id: '00uFAKE1', scope: 'USER' } });
  });

  it('reads USER and GROUP off a well-formed embed', () => {
    expect(extractAppAssignmentScope({ user: { id: '00uFAKE1', scope: 'USER' } })).toBe('USER');
    expect(extractAppAssignmentScope({ user: { id: '00uFAKE1', scope: 'GROUP' } })).toBe('GROUP');
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['a string', 'nonsense'],
    ['a number', 7],
    ['an empty object', {}],
    ['an array', [{ user: { id: '00uFAKE1', scope: 'USER' } }]],
    ['a non-object user', { user: 'nonsense' }],
    ['a user missing its id', { user: { scope: 'USER' } }],
    ['a user with no scope', { user: { id: '00uFAKE1' } }],
    ['an unrecognized scope', { user: { id: '00uFAKE1', scope: 'SOMETHING_NEW' } }],
    ['a non-string scope', { user: { id: '00uFAKE1', scope: 7 } }],
  ])('returns undefined (never throws, never guesses) for %s', (_label, embedded) => {
    expect(extractAppAssignmentScope(embedded)).toBeUndefined();
  });

  it('reuses the app-user schema, so passthrough extras on the embed are harmless', () => {
    const scope = extractAppAssignmentScope({
      user: {
        id: '00uFAKE1',
        scope: 'GROUP',
        status: 'PROVISIONED',
        credentials: { userName: 'user@example.com' },
        orgSpecificExtra: { anything: true },
      },
    });
    expect(scope).toBe('GROUP');
  });
});

/**
 * `features` on an app row is what makes the profile-attribute editability gate
 * a per-user question rather than an org-wide one: `PROFILE_MASTERING` marks the
 * app as a profile source, and a user attached to none of them is Okta-mastered.
 * It rides the app-assignment walk, so the read must be as forgiving as the
 * scope read beside it — an app is never worth losing over it.
 */
describe('isProfileSourceApp (features on oktaAppListItemSchema)', () => {
  it('reads PROFILE_MASTERING off a real profile-source app', () => {
    expect(
      isProfileSourceApp(['IMPORT_PROFILE_UPDATES', 'PROFILE_MASTERING', 'IMPORT_NEW_USERS']),
    ).toBe(true);
  });

  /*
   * The distinction that decides the gate. An app can import profile updates
   * without being anyone's source of truth, so accepting IMPORT_PROFILE_UPDATES
   * as a synonym would lock attributes for every user of every provisioned app.
   */
  it('does not accept IMPORT_PROFILE_UPDATES as a synonym', () => {
    expect(isProfileSourceApp(['IMPORT_PROFILE_UPDATES', 'IMPORT_NEW_USERS'])).toBe(false);
  });

  it.each([
    ['no features at all', undefined],
    ['an empty list', []],
    ['unrelated features', ['SSO', 'GROUP_PUSH', 'PUSH_PROFILE_UPDATES']],
  ])('returns false for %s', (_label, features) => {
    expect(isProfileSourceApp(features as string[] | undefined)).toBe(false);
  });

  /*
   * The shape that produced the bug, reduced from a real Custom Identity Source
   * row (fake ids). `signOnMode` is `null` — an identity source has no sign-on
   * mode — and the field was `z.string().optional()`, which accepts `undefined`
   * and rejects `null`. `parseOktaList` drops a row that fails validation, so
   * the org's own profile source vanished from every user's app list: the Apps
   * pane lost an app, and the editability gate lost the only fact that locks a
   * `PROFILE_MASTER` attribute. ADR-0037.
   */
  it('keeps an identity-source app whose signOnMode is null, and reads it as a source', () => {
    const identitySource = {
      id: '0oaFAKEsrc00000000',
      orn: 'orn:okta:idp:00oFAKE:apps:custom_identity_source:0oaFAKEsrc00000000',
      name: 'custom_identity_source',
      label: 'Example Identity Source',
      status: 'ACTIVE',
      signOnMode: null,
      created: '2024-05-21T15:18:07.000Z',
      lastUpdated: '2024-06-04T12:57:34.000Z',
      features: ['IMPORT_PROFILE_UPDATES', 'PROFILE_MASTERING', 'IMPORT_NEW_USERS'],
      _embedded: {
        user: { id: '00uFAKE1', scope: 'USER', status: 'ACTIVE', syncState: 'SYNCHRONIZED' },
      },
    };

    const apps = parseOktaList(oktaAppListItemSchema, [identitySource], 'test');

    expect(apps).toHaveLength(1);
    expect(isProfileSourceApp(apps[0].features)).toBe(true);
    // Null degrades to "not reported" rather than costing the row.
    expect(apps[0].signOnMode).toBeUndefined();
    expect(apps[0].label).toBe('Example Identity Source');
  });

  /*
   * The general form of the same rule: no field below `id` may cost the row.
   * Enumerating which fields Okta may null is the losing move.
   */
  it.each([
    ['signOnMode', { signOnMode: null }],
    ['status', { status: null }],
    ['label', { label: null }],
    ['name', { name: null }],
    ['created', { created: 42 }],
    ['lastUpdated', { lastUpdated: {} }],
    ['label as a number', { label: 7 }],
  ])('never drops an app row over a bad %s', (_label, override) => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const apps = parseOktaList(
      oktaAppListItemSchema,
      [{ id: '0oaFAKE1', label: 'One', ...override }],
      'test',
    );

    expect(apps.map((a) => a.id)).toEqual(['0oaFAKE1']);
  });

  it('parses features off a well-formed row', () => {
    const apps = parseOktaList(
      oktaAppListItemSchema,
      [
        {
          id: '0oaFAKE1',
          label: 'Workday',
          features: ['PROFILE_MASTERING'],
          orn: 'orn:okta:idp:00oFAKE:custom_identity_source:0oaFAKE1',
        },
      ],
      'test',
    );

    expect(isProfileSourceApp(apps[0].features)).toBe(true);
    expect(apps[0].orn).toBe('orn:okta:idp:00oFAKE:custom_identity_source:0oaFAKE1');
  });

  /*
   * `parseOktaList` DROPS a row that fails validation, so without the `.catch()`
   * on these fields a malformed `features` would remove the app from a user's
   * list entirely — under-reporting access to fix a badge. Every row survives,
   * and the unreadable ones simply report no features.
   */
  it('never drops an app row over a malformed features or orn value', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const rows = [
      { id: '0oaFAKE1', label: 'One', features: ['PROFILE_MASTERING'] },
      { id: '0oaFAKE2', label: 'Two', features: 'PROFILE_MASTERING' },
      { id: '0oaFAKE3', label: 'Three', features: [7, null] },
      { id: '0oaFAKE4', label: 'Four', features: null },
      { id: '0oaFAKE5', label: 'Five', orn: 42 },
    ];

    const apps = parseOktaList(oktaAppListItemSchema, rows, 'test');

    expect(apps.map((a) => a.id)).toEqual([
      '0oaFAKE1',
      '0oaFAKE2',
      '0oaFAKE3',
      '0oaFAKE4',
      '0oaFAKE5',
    ]);
    // Unreadable → undefined → not a source. Absence never unlocks an attribute
    // on its own; see the `profileMastering` suite.
    expect(apps.slice(1).map((a) => isProfileSourceApp(a.features))).toEqual([
      false,
      false,
      false,
      false,
    ]);
  });
});

/**
 * The same `expand=user/{userId}` embed also names the group Okta credits for
 * the assignment, at `_embedded.user._links.group.href`. `extractAppGrantGroupId`
 * is the read: it must never drop the app, never throw, and — because the value
 * comes out of an untrusted response body and is destined for a request path —
 * never return a segment that is not a well-formed Okta group id.
 */
describe('extractAppGrantGroupId (_embedded.user._links.group.href)', () => {
  /** Build an embed whose group link points at `href`. */
  const embedWithHref = (href: unknown) => ({
    user: { id: '00uFAKE0001', scope: 'GROUP', _links: { group: { href } } },
  });

  it('extracts the trailing 00g… segment of a well-formed group href', () => {
    expect(
      extractAppGrantGroupId(
        embedWithHref('https://example.okta.com/api/v1/groups/00gFAKEgroup00000001'),
      ),
    ).toBe('00gFAKEgroup00000001');
  });

  it('accepts a relative href and ignores a trailing slash, query and fragment', () => {
    expect(extractAppGrantGroupId(embedWithHref('/api/v1/groups/00gFAKEgroup00000001/'))).toBe(
      '00gFAKEgroup00000001',
    );
    expect(
      extractAppGrantGroupId(embedWithHref('/api/v1/groups/00gFAKEgroup00000001?expand=stats')),
    ).toBe('00gFAKEgroup00000001');
    expect(extractAppGrantGroupId(embedWithHref('/api/v1/groups/00gFAKEgroup00000001#x'))).toBe(
      '00gFAKEgroup00000001',
    );
  });

  it.each([
    ['no _links at all', { user: { id: '00uFAKE0001', scope: 'USER' } }],
    ['_links with no group', { user: { id: '00uFAKE0001', _links: { self: { href: '/x' } } } }],
    ['a group link with no href', { user: { id: '00uFAKE0001', _links: { group: {} } } }],
    ['an undefined embed', undefined],
    ['a null embed', null],
    ['a string embed', 'nonsense'],
    ['an array embed', [{ user: { _links: { group: { href: '/api/v1/groups/00gFAKE1' } } } }]],
    ['a non-object user', { user: 'nonsense' }],
    ['a user missing its id', { _links: { group: { href: '/api/v1/groups/00gFAKE1' } } }],
  ])('returns undefined for %s', (_label, embedded) => {
    expect(extractAppGrantGroupId(embedded)).toBeUndefined();
  });

  it.each([
    // A user id is not a group id — the prefix check is the whole point.
    ['a user id', '/api/v1/users/00uFAKE00000000000001'],
    // Path traversal: the trailing segment is attacker-chosen, and this value
    // would be interpolated straight into a request path if it were trusted.
    ['a traversal path', 'https://example.okta.com/api/v1/groups/00gFAKE/../../../users/me'],
    ['a bare traversal', '../../etc/passwd'],
    ['a traversal ending in a slash', '/api/v1/groups/00gFAKEgroup00000001/../../'],
    ['an empty href', ''],
    ['only slashes', '///'],
    ['a query string with no path segment', '?groupId=00gFAKEgroup00000001'],
    ['a too-short group id', '/api/v1/groups/00gFAKE001'],
    ['a group id with a path separator smuggled in', '/api/v1/groups/00gFAKEgroup00000001%2Fx'],
    ['a non-alphanumeric group id', '/api/v1/groups/00gFAKE-group-00001'],
  ])('rejects %s and returns undefined', (_label, href) => {
    expect(extractAppGrantGroupId(embedWithHref(href))).toBeUndefined();
  });

  it('returns undefined when the href is not a string', () => {
    expect(extractAppGrantGroupId(embedWithHref(42))).toBeUndefined();
    expect(extractAppGrantGroupId(embedWithHref(null))).toBeUndefined();
    expect(
      extractAppGrantGroupId(embedWithHref({ toString: () => '/api/v1/groups/00gFAKE1' })),
    ).toBeUndefined();
  });

  it('reports both scope USER and a grant group — Okta prefers USER, it does not exclude a group', () => {
    const embedded = {
      user: {
        id: '00uFAKE0001',
        scope: 'USER',
        _links: { group: { href: '/api/v1/groups/00gFAKEgroup00000001' } },
      },
    };
    // Both facts are true at once; neither reading may suppress the other.
    expect(extractAppAssignmentScope(embedded)).toBe('USER');
    expect(extractAppGrantGroupId(embedded)).toBe('00gFAKEgroup00000001');
  });

  it('a malformed _links costs neither the app-user row nor its scope', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const rows = [
      { id: '00uFAKE0001', scope: 'USER', _links: 'nonsense' },
      { id: '00uFAKE0002', scope: 'GROUP', _links: [1, 2, 3] },
      { id: '00uFAKE0003', scope: 'GROUP', _links: { group: 'nonsense' } },
    ];

    // parseOktaList DROPS a row that fails validation, so a strict `_links`
    // would silently remove an app-user. Every row must survive.
    const parsed = parseOktaList(oktaAppUserSchema, rows, 'test');
    expect(parsed.map((r) => r.id)).toEqual(['00uFAKE0001', '00uFAKE0002', '00uFAKE0003']);

    // …and the scope read off the same object is unaffected by the bad link.
    expect(extractAppAssignmentScope({ user: rows[0] })).toBe('USER');
    expect(extractAppGrantGroupId({ user: rows[0] })).toBeUndefined();
    vi.restoreAllMocks();
  });
});
