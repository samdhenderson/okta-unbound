/**
 * @module hooks/useOktaApi/appOperations.test
 * @description Unit tests for the app search operation.
 *
 * Drives `searchApps` through a fully-mocked `CoreApi`, asserting the request
 * shape, the `label || name || id` fallback, the short-query and error
 * short-circuits, and that malformed rows are dropped by boundary validation.
 * Fixtures use fake placeholders (`0oaFAKE…`) per CLAUDE.md.
 */
import { describe, it, expect, vi } from 'vitest';
import { createAppOperations } from './appOperations';
import type { CoreApi } from './core';

/** Build a fake CoreApi whose transport is fully mocked. */
function makeCore(overrides: Partial<CoreApi> = {}): CoreApi {
  return {
    targetTabId: 1,
    sendMessage: vi.fn(),
    makeApiRequest: vi.fn().mockResolvedValue({ success: true, data: [] }),
    getCurrentUser: vi.fn(),
    checkCancelled: vi.fn(),
    resetCancellation: vi.fn(),
    runOperation: vi.fn(),
    callbacks: {},
    ...overrides,
  } as unknown as CoreApi;
}

describe('searchApps', () => {
  it('returns [] for queries shorter than 2 chars without calling the API', async () => {
    const core = makeCore();
    const { searchApps } = createAppOperations(core);

    expect(await searchApps('a')).toEqual([]);
    expect(core.makeApiRequest).not.toHaveBeenCalled();
  });

  it('queries /api/v1/apps with an encoded q and maps label||name||id', async () => {
    const core = makeCore({
      makeApiRequest: vi.fn().mockResolvedValue({
        success: true,
        data: [
          { id: '0oaFAKE1', label: 'Salesforce', name: 'salesforce', status: 'ACTIVE' },
          { id: '0oaFAKE2', name: 'okta_org2org', status: 'INACTIVE' },
          { id: '0oaFAKE3' },
        ],
      }),
    });
    const { searchApps } = createAppOperations(core);

    const result = await searchApps('sales force');

    expect(core.makeApiRequest).toHaveBeenCalledWith('/api/v1/apps?q=sales%20force&limit=20');
    expect(result).toEqual([
      { id: '0oaFAKE1', label: 'Salesforce', status: 'ACTIVE' },
      { id: '0oaFAKE2', label: 'okta_org2org', status: 'INACTIVE' },
      { id: '0oaFAKE3', label: '0oaFAKE3', status: undefined },
    ]);
  });

  it('drops rows failing validation (missing id) but keeps valid ones', async () => {
    const core = makeCore({
      makeApiRequest: vi.fn().mockResolvedValue({
        success: true,
        data: [{ label: 'no id' }, { id: '0oaFAKE9', label: 'Good' }],
      }),
    });
    const { searchApps } = createAppOperations(core);

    expect(await searchApps('good')).toEqual([
      { id: '0oaFAKE9', label: 'Good', status: undefined },
    ]);
  });

  it('returns [] when the request fails', async () => {
    const core = makeCore({
      makeApiRequest: vi.fn().mockResolvedValue({ success: false, error: 'boom' }),
    });
    const { searchApps } = createAppOperations(core);
    expect(await searchApps('anything')).toEqual([]);
  });

  it('returns [] (never throws) when the transport rejects', async () => {
    const core = makeCore({
      makeApiRequest: vi.fn().mockRejectedValue(new Error('network')),
    });
    const { searchApps } = createAppOperations(core);
    expect(await searchApps('anything')).toEqual([]);
  });
});
