import { describe, it, expect } from 'vitest';
import { oktaUserSchema, oktaGroupSchema, parseOkta } from './okta';

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
