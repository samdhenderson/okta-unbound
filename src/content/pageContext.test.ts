/**
 * Unit tests for the pure page-context extractors (`src/content/pageContext.ts`).
 *
 * The group / user / app extractors are covered end-to-end through the message
 * handlers in `index.test.ts` (including their pinned quirks). This file covers the
 * **policy** extractors directly, because policy detection is the one extractor with
 * a strict id-shape guard — the interesting cases (a route that matches but whose
 * segment is not a policy id) are invisible from the handler's success/failure
 * surface alone.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { extractPolicyIdFromUrl, extractPolicyNameFromPage } from './pageContext';

/** Obviously-fake ids matching Okta's two policy id prefixes. */
const RST_ID = 'rstFAKE0123456789abc';
const P00_ID = '00pFAKE0123456789abc';

const ORIGIN = 'https://example.okta.com';

describe('extractPolicyIdFromUrl', () => {
  describe('valid routes', () => {
    const routes: Array<[string, string]> = [
      [`${ORIGIN}/admin/authn/policies/${RST_ID}`, RST_ID],
      [`${ORIGIN}/admin/authn/policies/${P00_ID}`, P00_ID],
      [`${ORIGIN}/admin/access/policies/${RST_ID}`, RST_ID],
      [`${ORIGIN}/admin/access/policies/${P00_ID}`, P00_ID],
      // Trailing sub-view segments must not defeat the match.
      [`${ORIGIN}/admin/authn/policies/${RST_ID}/rules`, RST_ID],
      [`${ORIGIN}/admin/access/policies/${P00_ID}?tab=rules`, P00_ID],
      // Defensive generic /admin/policy/... forms.
      [`${ORIGIN}/admin/policy/${RST_ID}`, RST_ID],
      [`${ORIGIN}/admin/policy/edit/${RST_ID}`, RST_ID],
      [`${ORIGIN}/admin/policy/sign-on/${P00_ID}`, P00_ID],
      // API + query-parameter forms.
      [`${ORIGIN}/api/v1/policies/${RST_ID}`, RST_ID],
      [`${ORIGIN}/admin/anything?policyId=${P00_ID}`, P00_ID],
    ];

    it.each(routes)('%s → %s', (url, expected) => {
      expect(extractPolicyIdFromUrl(url)).toBe(expected);
    });
  });

  describe('rejections', () => {
    const rejected: Array<[string, string]> = [
      ['a non-policy admin page', `${ORIGIN}/admin/dashboard`],
      ['the policy list page', `${ORIGIN}/admin/authn/policies`],
      ['the new-policy sub-view keyword', `${ORIGIN}/admin/authn/policies/new`],
      ['the create keyword', `${ORIGIN}/admin/access/policies/create`],
      ['the settings keyword', `${ORIGIN}/admin/policy/settings`],
      [
        'a group id in a policy-shaped route',
        `${ORIGIN}/admin/authn/policies/00gFAKE0123456789abc`,
      ],
      ['an app id in a policy-shaped route', `${ORIGIN}/admin/authn/policies/0oaFAKE0123456789abc`],
      ['a too-short rst id', `${ORIGIN}/admin/authn/policies/rstSHORT`],
      ['a too-short 00p id', `${ORIGIN}/admin/access/policies/00pSHORT`],
      ['a prefix-only id', `${ORIGIN}/admin/authn/policies/rst`],
      ['a group page', `${ORIGIN}/admin/group/00gFAKE0123456789abc`],
      ['a user page', `${ORIGIN}/admin/user/profile/view/00uFAKE0123456789abc`],
    ];

    it.each(rejected)('rejects %s', (_name, url) => {
      expect(extractPolicyIdFromUrl(url)).toBeNull();
    });
  });

  it('is case-sensitive about the prefix (RST is not a policy id)', () => {
    expect(
      extractPolicyIdFromUrl(`${ORIGIN}/admin/authn/policies/RSTFAKE0123456789abc`),
    ).toBeNull();
  });

  it('prefers the authn route over a later generic policy segment', () => {
    expect(
      extractPolicyIdFromUrl(`${ORIGIN}/admin/authn/policies/${RST_ID}/admin/policy/${P00_ID}`),
    ).toBe(RST_ID);
  });
});

describe('extractPolicyNameFromPage', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('returns null when nothing matches', () => {
    expect(extractPolicyNameFromPage()).toBeNull();
  });

  it('reads the highest-priority data-se selector', () => {
    document.body.innerHTML = '<span data-se="policy-name"> Contractor MFA </span>';
    expect(extractPolicyNameFromPage()).toBe('Contractor MFA');
  });

  it('prefers data-se="policy-name" over a generic content-container heading', () => {
    document.body.innerHTML =
      '<div class="content-container"><h1>Lower Priority</h1></div>' +
      '<span data-se="policy-name">Winner</span>';
    expect(extractPolicyNameFromPage()).toBe('Winner');
  });

  it('falls back through the selector list to a main heading', () => {
    document.body.innerHTML = '<main><h1>Any Two Factor</h1></main>';
    expect(extractPolicyNameFromPage()).toBe('Any Two Factor');
  });

  it('skips a generic label and continues to the next selector', () => {
    document.body.innerHTML =
      '<span data-se="policy-name">Authentication Policies</span>' +
      '<main><h1>Real Policy Name</h1></main>';
    expect(extractPolicyNameFromPage()).toBe('Real Policy Name');
  });

  it('skips a blank match and continues (unlike the group scraper)', () => {
    document.body.innerHTML =
      '<span data-se="policy-name">   </span><main><h1>Real Policy Name</h1></main>';
    expect(extractPolicyNameFromPage()).toBe('Real Policy Name');
  });
});
