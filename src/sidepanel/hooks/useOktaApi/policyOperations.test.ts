/**
 * @module hooks/useOktaApi/policyOperations.test
 * @description Unit tests for the read-only policy operations.
 *
 * Drives `listPolicies` / `getPolicyRules` / `getAppAccessPolicyId` through a
 * fully-mocked `CoreApi` (never chrome), asserting the request shapes, the
 * default `ACCESS_POLICY` type, `Link`-header pagination follow, lenient
 * boundary validation (malformed rows dropped), the never-throw degrade posture,
 * and the defensive `_links.accessPolicy.href` parsing. Fixtures use fake
 * placeholders (`rstFAKE…`, `0oaFAKE…`) per CLAUDE.md.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  createPolicyOperations,
  extractAccessPolicyId,
  OKTA_POLICY_TYPES,
} from './policyOperations';
import type { CoreApi } from './core';
import { makeFakeCore } from '@/test/factories/coreApi';

/** Build a fake CoreApi whose transport is fully mocked. */
const makeCore = (overrides: Partial<CoreApi> = {}): CoreApi =>
  makeFakeCore({
    makeApiRequest: vi.fn().mockResolvedValue({ success: true, data: [] }),
    getCurrentUser: vi.fn(),
    ...overrides,
  });

const policy = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  name: `Policy ${id}`,
  status: 'ACTIVE',
  type: 'ACCESS_POLICY',
  priority: 1,
  system: false,
  ...extra,
});

describe('OKTA_POLICY_TYPES', () => {
  it('covers the four listable policy types', () => {
    expect(OKTA_POLICY_TYPES).toEqual(['ACCESS_POLICY', 'OKTA_SIGN_ON', 'MFA_ENROLL', 'PASSWORD']);
  });
});

describe('listPolicies', () => {
  it('defaults to type=ACCESS_POLICY and returns the validated page', async () => {
    const core = makeCore({
      makeApiRequest: vi.fn().mockResolvedValue({
        success: true,
        data: [policy('rstFAKEpolicy00000001'), policy('rstFAKEpolicy00000002')],
        headers: {},
      }),
    });
    const { listPolicies } = createPolicyOperations(core);

    const result = await listPolicies();

    expect(core.makeApiRequest).toHaveBeenCalledWith(
      '/api/v1/policies?type=ACCESS_POLICY&limit=200',
      'GET',
      undefined,
      'normal',
    );
    expect(result.map((p) => p.id)).toEqual(['rstFAKEpolicy00000001', 'rstFAKEpolicy00000002']);
    expect(result[0].name).toBe('Policy rstFAKEpolicy00000001');
  });

  it('passes an explicit type through to the endpoint', async () => {
    const core = makeCore({
      makeApiRequest: vi.fn().mockResolvedValue({ success: true, data: [], headers: {} }),
    });
    const { listPolicies } = createPolicyOperations(core);

    await listPolicies('MFA_ENROLL');

    expect(core.makeApiRequest).toHaveBeenCalledWith(
      '/api/v1/policies?type=MFA_ENROLL&limit=200',
      'GET',
      undefined,
      'normal',
    );
  });

  it('follows the Link header across pages and concatenates results', async () => {
    const makeApiRequest = vi
      .fn()
      .mockResolvedValueOnce({
        success: true,
        data: [policy('rstFAKEpolicy00000001')],
        headers: {
          link: '<https://example.okta.com/api/v1/policies?type=ACCESS_POLICY&after=1>; rel="next"',
        },
      })
      .mockResolvedValueOnce({
        success: true,
        data: [policy('rstFAKEpolicy00000002')],
        headers: {},
      });
    const core = makeCore({ makeApiRequest });
    const { listPolicies } = createPolicyOperations(core);

    const result = await listPolicies();

    expect(makeApiRequest).toHaveBeenCalledTimes(2);
    expect(makeApiRequest.mock.calls[1][0]).toBe('/api/v1/policies?type=ACCESS_POLICY&after=1');
    expect(result.map((p) => p.id)).toEqual(['rstFAKEpolicy00000001', 'rstFAKEpolicy00000002']);
  });

  it('drops malformed rows (missing id) but keeps the valid ones', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const core = makeCore({
      makeApiRequest: vi.fn().mockResolvedValue({
        success: true,
        data: [{ name: 'no id' }, 'not-an-object', policy('rstFAKEpolicy00000009')],
        headers: {},
      }),
    });
    const { listPolicies } = createPolicyOperations(core);

    const result = await listPolicies();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('rstFAKEpolicy00000009');
    vi.restoreAllMocks();
  });

  it('preserves unknown fields via passthrough (never strips _links)', async () => {
    const core = makeCore({
      makeApiRequest: vi.fn().mockResolvedValue({
        success: true,
        data: [
          policy('rstFAKEpolicy00000003', {
            _links: { rules: { href: 'https://example.okta.com/api/v1/policies/x/rules' } },
            conditions: { people: { groups: { include: [] } } },
          }),
        ],
        headers: {},
      }),
    });
    const { listPolicies } = createPolicyOperations(core);

    const [result] = await listPolicies();

    expect(result._links).toBeDefined();
    expect((result as Record<string, unknown>).conditions).toBeDefined();
  });

  it('returns [] (never throws) when a page fails', async () => {
    const core = makeCore({
      makeApiRequest: vi.fn().mockResolvedValue({ success: false, error: 'forbidden' }),
    });
    const { listPolicies } = createPolicyOperations(core);

    expect(await listPolicies()).toEqual([]);
  });

  it('returns [] (never throws) when the transport rejects', async () => {
    const core = makeCore({
      makeApiRequest: vi.fn().mockRejectedValue(new Error('network')),
    });
    const { listPolicies } = createPolicyOperations(core);

    expect(await listPolicies()).toEqual([]);
  });
});

describe('getPolicyRules', () => {
  it('reads the rules endpoint and returns validated rules', async () => {
    const core = makeCore({
      makeApiRequest: vi.fn().mockResolvedValue({
        success: true,
        data: [
          {
            id: 'rulFAKErule000000001',
            name: 'Catch-all',
            status: 'ACTIVE',
            priority: 1,
            system: true,
            conditions: { network: { connection: 'ANYWHERE' } },
            actions: { appSignOn: { access: 'ALLOW' } },
          },
        ],
      }),
    });
    const { getPolicyRules } = createPolicyOperations(core);

    const rules = await getPolicyRules('rstFAKEpolicy00000001');

    expect(core.makeApiRequest).toHaveBeenCalledWith(
      '/api/v1/policies/rstFAKEpolicy00000001/rules',
      'GET',
      undefined,
      'normal',
    );
    expect(rules).toHaveLength(1);
    expect(rules[0].name).toBe('Catch-all');
    // conditions/actions are typed unknown but preserved verbatim.
    expect(rules[0].actions).toEqual({ appSignOn: { access: 'ALLOW' } });
  });

  it('drops malformed rules and keeps the valid ones', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const core = makeCore({
      makeApiRequest: vi.fn().mockResolvedValue({
        success: true,
        data: [{ name: 'no id' }, { id: 'rulFAKErule000000002' }],
      }),
    });
    const { getPolicyRules } = createPolicyOperations(core);

    const rules = await getPolicyRules('rstFAKEpolicy00000001');

    expect(rules).toEqual([{ id: 'rulFAKErule000000002' }]);
    vi.restoreAllMocks();
  });

  it('returns [] when the request fails', async () => {
    const core = makeCore({
      makeApiRequest: vi.fn().mockResolvedValue({ success: false, error: 'forbidden' }),
    });
    const { getPolicyRules } = createPolicyOperations(core);

    expect(await getPolicyRules('rstFAKEpolicy00000001')).toEqual([]);
  });

  it('returns [] (never throws) when the transport rejects', async () => {
    const core = makeCore({ makeApiRequest: vi.fn().mockRejectedValue(new Error('network')) });
    const { getPolicyRules } = createPolicyOperations(core);

    expect(await getPolicyRules('rstFAKEpolicy00000001')).toEqual([]);
  });
});

describe('getAppAccessPolicyId', () => {
  /** Build an app payload carrying an accessPolicy href. */
  const appWithHref = (href: string) => ({
    success: true,
    data: { id: '0oaFAKEapp000000001', label: 'Fake App', _links: { accessPolicy: { href } } },
  });

  it('extracts the trailing policy id from _links.accessPolicy.href', async () => {
    const core = makeCore({
      makeApiRequest: vi
        .fn()
        .mockResolvedValue(
          appWithHref('https://example.okta.com/api/v1/policies/rstFAKEpolicy00000001'),
        ),
    });
    const { getAppAccessPolicyId } = createPolicyOperations(core);

    expect(await getAppAccessPolicyId('0oaFAKEapp000000001')).toBe('rstFAKEpolicy00000001');
    expect(core.makeApiRequest).toHaveBeenCalledWith(
      '/api/v1/apps/0oaFAKEapp000000001',
      'GET',
      undefined,
      'normal',
    );
  });

  it('accepts the 00p policy id prefix and ignores query/trailing slash', async () => {
    const core = makeCore({
      makeApiRequest: vi
        .fn()
        .mockResolvedValue(
          appWithHref('https://example.okta.com/api/v1/policies/00pFAKEpolicy00000001/?expand=x'),
        ),
    });
    const { getAppAccessPolicyId } = createPolicyOperations(core);

    expect(await getAppAccessPolicyId('0oaFAKEapp000000001')).toBe('00pFAKEpolicy00000001');
  });

  it('returns null when the app has no _links', async () => {
    const core = makeCore({
      makeApiRequest: vi
        .fn()
        .mockResolvedValue({ success: true, data: { id: '0oaFAKEapp000000001' } }),
    });
    const { getAppAccessPolicyId } = createPolicyOperations(core);

    expect(await getAppAccessPolicyId('0oaFAKEapp000000001')).toBeNull();
  });

  it('returns null when _links carries no accessPolicy href', async () => {
    const core = makeCore({
      makeApiRequest: vi.fn().mockResolvedValue({
        success: true,
        data: { id: '0oaFAKEapp000000001', _links: { accessPolicy: { notAnHref: 1 } } },
      }),
    });
    const { getAppAccessPolicyId } = createPolicyOperations(core);

    expect(await getAppAccessPolicyId('0oaFAKEapp000000001')).toBeNull();
  });

  it('returns null for a malformed (empty / non-string) href', async () => {
    const { getAppAccessPolicyId: fromEmpty } = createPolicyOperations(
      makeCore({ makeApiRequest: vi.fn().mockResolvedValue(appWithHref('')) }),
    );
    expect(await fromEmpty('0oaFAKEapp000000001')).toBeNull();

    const { getAppAccessPolicyId: fromSlashes } = createPolicyOperations(
      makeCore({ makeApiRequest: vi.fn().mockResolvedValue(appWithHref('///')) }),
    );
    expect(await fromSlashes('0oaFAKEapp000000001')).toBeNull();

    const { getAppAccessPolicyId: fromNumber } = createPolicyOperations(
      makeCore({
        makeApiRequest: vi.fn().mockResolvedValue({
          success: true,
          data: { id: '0oaFAKEapp000000001', _links: { accessPolicy: { href: 42 } } },
        }),
      }),
    );
    expect(await fromNumber('0oaFAKEapp000000001')).toBeNull();
  });

  it('returns null when the trailing segment does not look like a policy id', async () => {
    // Wrong prefix, and a right-prefixed-but-too-short id: both rejected.
    const { getAppAccessPolicyId: wrongPrefix } = createPolicyOperations(
      makeCore({
        makeApiRequest: vi
          .fn()
          .mockResolvedValue(appWithHref('https://example.okta.com/api/v1/apps/0oaFAKEapp0000001')),
      }),
    );
    expect(await wrongPrefix('0oaFAKEapp000000001')).toBeNull();

    const { getAppAccessPolicyId: tooShort } = createPolicyOperations(
      makeCore({
        makeApiRequest: vi
          .fn()
          .mockResolvedValue(appWithHref('https://example.okta.com/api/v1/policies/rstShort')),
      }),
    );
    expect(await tooShort('0oaFAKEapp000000001')).toBeNull();
  });

  it('returns null when the request fails', async () => {
    const core = makeCore({
      makeApiRequest: vi.fn().mockResolvedValue({ success: false, error: 'forbidden' }),
    });
    const { getAppAccessPolicyId } = createPolicyOperations(core);

    expect(await getAppAccessPolicyId('0oaFAKEapp000000001')).toBeNull();
  });

  it('returns null (never throws) when the transport rejects', async () => {
    const core = makeCore({ makeApiRequest: vi.fn().mockRejectedValue(new Error('network')) });
    const { getAppAccessPolicyId } = createPolicyOperations(core);

    expect(await getAppAccessPolicyId('0oaFAKEapp000000001')).toBeNull();
  });
});

/**
 * The parsing above, exercised directly. The app Overview derives the attachment
 * from an app record it already holds rather than re-fetching `GET /api/v1/apps/{id}`,
 * so the guard has to hold as a pure function too — not only behind the request.
 */
describe('extractAccessPolicyId', () => {
  const href = (id: string) => ({ accessPolicy: { href: `/api/v1/policies/${id}` } });

  it('accepts both Okta policy id prefixes', () => {
    expect(extractAccessPolicyId(href('rstFAKEpolicy00000001'))).toBe('rstFAKEpolicy00000001');
    expect(extractAccessPolicyId(href('00pFAKEpolicy00000001'))).toBe('00pFAKEpolicy00000001');
  });

  it('ignores a query string, fragment and trailing slashes', () => {
    expect(
      extractAccessPolicyId({
        accessPolicy: { href: '/api/v1/policies/rstFAKEpolicy00000001/?expand=x#frag' },
      }),
    ).toBe('rstFAKEpolicy00000001');
  });

  it('returns null for anything that is not an access-policy link', () => {
    expect(extractAccessPolicyId(undefined)).toBeNull();
    expect(extractAccessPolicyId(null)).toBeNull();
    expect(extractAccessPolicyId('not an object')).toBeNull();
    expect(extractAccessPolicyId({})).toBeNull();
    expect(extractAccessPolicyId({ accessPolicy: {} })).toBeNull();
    expect(extractAccessPolicyId({ accessPolicy: { href: 42 } })).toBeNull();
  });

  it('rejects a segment that does not look like an Okta policy id', () => {
    // The guard is what stops a hostile or malformed href flowing into a request path.
    expect(extractAccessPolicyId(href('../../admin'))).toBeNull();
    expect(extractAccessPolicyId(href('rstTOOSHORT'))).toBeNull();
    expect(extractAccessPolicyId(href('xyzFAKEpolicy00000001'))).toBeNull();
    expect(extractAccessPolicyId({ accessPolicy: { href: '/api/v1/policies/' } })).toBeNull();
  });
});
