import { describe, it, expect } from 'vitest';
import { isOktaUrl } from './oktaUrl';

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
