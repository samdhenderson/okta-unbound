import { describe, it, expect } from 'vitest';
import { isOktaUrl, oktaAdminEntityUrl } from './oktaUrl';

describe('isOktaUrl', () => {
  it('matches commercial, preview, and EMEA Okta domains', () => {
    expect(isOktaUrl('https://acme.okta.com/app/UserHome')).toBe(true);
    expect(isOktaUrl('https://acme.oktapreview.com/admin')).toBe(true);
    expect(isOktaUrl('https://acme.okta-emea.com/')).toBe(true);
  });

  it('rejects non-Okta URLs', () => {
    expect(isOktaUrl('https://example.com')).toBe(false);
    expect(isOktaUrl('https://notokta.evil.com')).toBe(false);
  });

  it('tolerates null/undefined/empty input', () => {
    expect(isOktaUrl(null)).toBe(false);
    expect(isOktaUrl(undefined)).toBe(false);
    expect(isOktaUrl('')).toBe(false);
  });
});

describe('oktaAdminEntityUrl', () => {
  const origin = 'https://acme.okta.com';

  it('builds the per-entity admin deep links', () => {
    expect(oktaAdminEntityUrl(origin, 'group', '00g1')).toBe(`${origin}/admin/group/00g1`);
    expect(oktaAdminEntityUrl(origin, 'user', '00u1')).toBe(
      `${origin}/admin/user/profile/view/00u1`,
    );
    expect(oktaAdminEntityUrl(origin, 'app', '0oa1')).toBe(
      `${origin}/admin/app/0oa1/instance/0oa1`,
    );
  });

  it('returns null when the origin or id is missing', () => {
    expect(oktaAdminEntityUrl(null, 'group', '00g1')).toBeNull();
    expect(oktaAdminEntityUrl(undefined, 'user', '00u1')).toBeNull();
    expect(oktaAdminEntityUrl(origin, 'group', null)).toBeNull();
    expect(oktaAdminEntityUrl(origin, 'user', undefined)).toBeNull();
  });
});
