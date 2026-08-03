/**
 * @module hooks/useOktaApi/policyOperations
 * @description Read-only authentication/access policy operations (Auth Policies tab).
 *
 * Lists policies of a given type, reads a policy's rules, and resolves the access
 * policy attached to an app. Every request goes through the scheduler path
 * (side panel → background `ApiScheduler` → content script) and every response is
 * zod-validated at the boundary (ADR-0006).
 *
 * There are deliberately **no write operations here** — nothing in this module
 * mutates a policy, a rule, or an app.
 *
 * @remarks
 * Error posture: the reads here never throw. `listPolicies`/`getPolicyRules`
 * degrade to `[]` and `getAppAccessPolicyId` to `null`, logging the outcome only
 * — the same never-throw posture as the sibling app reads (`searchApps`,
 * `getAppPushGroupMappings`), chosen because policy endpoints are commonly
 * forbidden for non-super-admins and a single failure must not break the panel.
 * Callers that need to distinguish "no policies" from "read failed" should
 * surface that at the call site.
 */

import type { CoreApi } from './core';
import {
  oktaPolicyListItemSchema,
  oktaPolicyRuleSchema,
  parseOktaList,
  type OktaPolicyListItem,
  type OktaPolicyRule,
} from '@/shared/schemas/okta';
import { fetchAllPages, OKTA_PAGE_SIZE } from '@/shared/utils/oktaPagination';
import { createLogger } from '@/shared/utils/logger';

const log = createLogger('policyOperations');

/**
 * The Okta policy types this module can list.
 *
 * `ACCESS_POLICY` (app sign-on / authentication policies) is the default and the
 * one the Auth Policies tab is built around; the rest are listed for completeness
 * of the same `GET /api/v1/policies?type=` endpoint.
 */
export const OKTA_POLICY_TYPES = [
  'ACCESS_POLICY',
  'OKTA_SIGN_ON',
  'MFA_ENROLL',
  'PASSWORD',
] as const;

/** One of the {@link OKTA_POLICY_TYPES} values. */
export type OktaPolicyType = (typeof OKTA_POLICY_TYPES)[number];

/**
 * Shape an Okta id must match to be accepted as a policy id: the `rst`/`00p`
 * prefixes Okta uses for policies, followed by an alphanumeric body, 18+ chars
 * total. Guards {@link createPolicyOperations}'s href parsing so a surprising
 * `_links` value can never be pushed into a request path unchecked.
 */
const POLICY_ID_PATTERN = /^(?:rst|00p)[A-Za-z0-9]{15,}$/;

/**
 * Read `_links.accessPolicy.href` off an unknown-shaped value without trusting it.
 *
 * @param links - The app's `_links` value (typed `unknown`; shape varies per app).
 * @returns The href string when present, else `null`.
 */
function readAccessPolicyHref(links: unknown): string | null {
  if (!links || typeof links !== 'object') return null;
  const accessPolicy = (links as Record<string, unknown>).accessPolicy;
  if (!accessPolicy || typeof accessPolicy !== 'object') return null;
  const href = (accessPolicy as Record<string, unknown>).href;
  return typeof href === 'string' ? href : null;
}

/**
 * Extract the trailing path segment of a policy href (`…/api/v1/policies/{id}`).
 *
 * @param href - Raw href from `_links.accessPolicy.href`.
 * @returns The last non-empty path segment, or `null` when there is none.
 * @remarks Query string and fragment are stripped first, and trailing slashes are
 * ignored, so `…/policies/{id}/?x=1` still yields `{id}`. Parsed as a string
 * rather than via `new URL` so a relative href works too.
 */
function trailingSegment(href: string): string | null {
  const path = href.split('?')[0].split('#')[0].replace(/\/+$/, '');
  const segment = path.split('/').pop();
  return segment ? segment : null;
}

/**
 * Build read-only policy operations bound to a {@link CoreApi} transport.
 *
 * @param coreApi - Shared transport surface.
 * @returns `{ listPolicies, getPolicyRules, getAppAccessPolicyId }`.
 */
export function createPolicyOperations(coreApi: CoreApi) {
  /**
   * List every policy of one type, following `Link` pagination (200 per page).
   *
   * @param type - Policy type to list; defaults to `'ACCESS_POLICY'`.
   * @returns All validated policies across all pages; `[]` on failure (never throws).
   * @remarks Issued at `normal` priority, matching the other list reads. Each page
   * is validated with {@link oktaPolicyListItemSchema}, so malformed rows are
   * dropped leniently rather than thrown on (ADR-0006).
   */
  const listPolicies = async (
    type: OktaPolicyType = 'ACCESS_POLICY',
  ): Promise<OktaPolicyListItem[]> => {
    try {
      return await fetchAllPages<OktaPolicyListItem>(
        (url) => coreApi.makeApiRequest(url, 'GET', undefined, 'normal'),
        `/api/v1/policies?type=${encodeURIComponent(type)}&limit=${OKTA_PAGE_SIZE}`,
        {
          schema: oktaPolicyListItemSchema,
          context: 'GET /api/v1/policies',
        },
      );
    } catch {
      // Outcome + type only: never the response body or the error payload.
      log.error('listPolicies failed', { code: 'list_policies_failed', type });
      return [];
    }
  };

  /**
   * Read the rules attached to one policy.
   *
   * @param policyId - Policy whose rules to read.
   * @returns The validated rules; `[]` on failure (never throws).
   * @remarks Single request at `normal` priority — the rules endpoint is not
   * paginated in practice (a policy holds a handful of rules).
   */
  const getPolicyRules = async (policyId: string): Promise<OktaPolicyRule[]> => {
    try {
      const response = await coreApi.makeApiRequest(
        `/api/v1/policies/${encodeURIComponent(policyId)}/rules`,
        'GET',
        undefined,
        'normal',
      );
      if (!response.success) return [];
      return parseOktaList(oktaPolicyRuleSchema, response.data, 'GET /api/v1/policies/{id}/rules');
    } catch {
      // Identifier + outcome only.
      log.error('getPolicyRules failed', { code: 'policy_rules_failed', policyId });
      return [];
    }
  };

  /**
   * Resolve the id of the access policy attached to an app.
   *
   * @param appId - App to inspect.
   * @returns The access policy id, or `null` when the app has no access policy
   * link, the link is unparseable, the extracted id does not look like an Okta
   * policy id, or the request fails. Never throws.
   * @remarks Okta exposes the attachment only as `_links.accessPolicy.href` on
   * `GET /api/v1/apps/{id}`, whose shape is not contractually stable — it is read
   * defensively off an `unknown` and the extracted segment is then checked against
   * {@link POLICY_ID_PATTERN}, so a hostile or malformed href can never flow into
   * a follow-up request path.
   */
  const getAppAccessPolicyId = async (appId: string): Promise<string | null> => {
    try {
      const response = await coreApi.makeApiRequest(
        `/api/v1/apps/${encodeURIComponent(appId)}`,
        'GET',
        undefined,
        'normal',
      );
      if (!response.success || !response.data || typeof response.data !== 'object') return null;

      const href = readAccessPolicyHref((response.data as Record<string, unknown>)._links);
      if (!href) return null;

      const candidate = trailingSegment(href);
      if (!candidate || !POLICY_ID_PATTERN.test(candidate)) return null;

      return candidate;
    } catch {
      // Identifier + outcome only.
      log.error('getAppAccessPolicyId failed', { code: 'app_access_policy_failed', appId });
      return null;
    }
  };

  return { listPolicies, getPolicyRules, getAppAccessPolicyId };
}
