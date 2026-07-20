import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  oktaUserSchema,
  oktaGroupSchema,
  oktaUserListItemSchema,
  oktaGroupListItemSchema,
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
