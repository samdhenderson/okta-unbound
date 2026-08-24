/**
 * Tests for redact — the API Explorer's PII/id-scrubbing pass. Pins the
 * pattern-replacement order (email before phone, known ids before the generic
 * fallback) and the bounded generic-id regex's false-positive resistance, since
 * both are real correctness risks, not just style.
 */
import { describe, it, expect } from 'vitest';
import { redactJson } from './redact';

describe('redactJson', () => {
  it('redacts an email address', () => {
    const { data, redactedCount } = redactJson({ email: 'jane.doe@example.com' });
    expect(data).toEqual({ email: '<EMAIL>' });
    expect(redactedCount).toBe(1);
  });

  it('redacts a separated phone number', () => {
    const { data } = redactJson({ mobilePhone: '555-123-4567' });
    expect(data).toEqual({ mobilePhone: '<PHONE>' });
  });

  it('does not redact a bare unseparated digit run', () => {
    const { data, redactedCount } = redactJson({ count: '5551234567' });
    expect(data).toEqual({ count: '5551234567' });
    expect(redactedCount).toBe(0);
  });

  it.each([
    ['00u1a2b3c4d5e6f7g8h9', '<USER_ID>'],
    ['00g1a2b3c4d5e6f7g8h9', '<GROUP_ID>'],
    ['0oa1a2b3c4d5e6f7g8h9', '<APP_ID>'],
    ['00p1a2b3c4d5e6f7g8h9', '<POLICY_ID>'],
    ['rst1a2b3c4d5e6f7g8h9', '<POLICY_ID>'],
    ['aus1a2b3c4d5e6f7g8h9', '<AUTH_SERVER_ID>'],
  ])('redacts a known-prefix Okta id %s as %s', (id, placeholder) => {
    const { data } = redactJson({ id });
    expect(data).toEqual({ id: placeholder });
  });

  it('falls back to a generic placeholder for an unrecognized but id-shaped prefix', () => {
    const { data } = redactJson({ id: 'zzz1a2b3c4d5e6f7g8h9' });
    expect(data).toEqual({ id: '<OKTA_ID>' });
  });

  it('does not relabel an uppercase-start token regardless of length', () => {
    const sessionToken = 'A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6';
    const { data, redactedCount } = redactJson({ token: sessionToken });
    expect(data).toEqual({ token: sessionToken });
    expect(redactedCount).toBe(0);
  });

  it('does not relabel a lowercase-start token of the wrong length', () => {
    const shortToken = 'ab1234567890123'; // 15 chars, one short of the 20-char id shape
    const { data, redactedCount } = redactJson({ token: shortToken });
    expect(data).toEqual({ token: shortToken });
    expect(redactedCount).toBe(0);
  });

  it('replaces the org hostname embedded in a URL, including the id inside it', () => {
    const { data, redactedCount } = redactJson(
      {
        _links: { self: { href: 'https://acme.okta.com/api/v1/groups/00g1a2b3c4d5e6f7g8h9' } },
      },
      'https://acme.okta.com',
    );
    expect(data).toEqual({
      _links: { self: { href: 'https://<OKTA_ORG>/api/v1/groups/<GROUP_ID>' } },
    });
    expect(redactedCount).toBe(2);
  });

  it('resolves an overlapping email/phone/id string in the documented order', () => {
    // The email's local part deliberately contains an id-shaped fragment
    // (`00u1abc...`) to pin that email-before-id ordering claims it first.
    const input = 'contact jane.doe+00u1abcdefgh12345@example.com or 555-123-4567';
    const { data, redactedCount } = redactJson({ note: input }, 'https://acme.okta.com');
    // The email regex claims the whole `local@domain` span first (including the
    // id-shaped local-part fragment inside it), then the phone number outside it
    // is matched separately. The unrelated org hostname (acme.okta.com) doesn't
    // appear in this string, so no `<OKTA_ORG>` substitution happens here.
    expect(data).toEqual({ note: 'contact <EMAIL> or <PHONE>' });
    expect(redactedCount).toBe(2);
  });

  it('leaves non-string leaves untouched', () => {
    const { data, redactedCount } = redactJson({ active: true, count: 42, note: null });
    expect(data).toEqual({ active: true, count: 42, note: null });
    expect(redactedCount).toBe(0);
  });

  it('recurses through arrays and nested objects', () => {
    const { data, redactedCount } = redactJson({
      users: [{ profile: { email: 'a@b.com' } }, { profile: { email: 'c@d.com' } }],
    });
    expect(data).toEqual({
      users: [{ profile: { email: '<EMAIL>' } }, { profile: { email: '<EMAIL>' } }],
    });
    expect(redactedCount).toBe(2);
  });

  it('skips hostname redaction when no origin is given', () => {
    const { data } = redactJson({ href: 'https://acme.okta.com/api/v1/users/me' });
    expect(data).toEqual({ href: 'https://acme.okta.com/api/v1/users/me' });
  });
});
