/**
 * Tests for the push-group mapping operations: zod validation at the response
 * boundary (ADR-0006) — malformed assignment rows are dropped leniently by
 * `parseOktaList`, never thrown on, while valid rows still map to
 * `PushGroupMapping` records.
 *
 * Fixtures use only fake placeholders (`0oaFAKE…`, `00gFAKE…`,
 * `example.okta.com`) per CLAUDE.md.
 */
import { describe, it, expect, vi } from 'vitest';
import { createPushGroupOperations } from './pushGroupOps';
import type { CoreApi } from './core';

/** Build a fake CoreApi whose transport is fully mocked. */
function makeCore(overrides: Partial<CoreApi> = {}): CoreApi {
  return {
    targetTabId: 1,
    sendMessage: vi.fn(),
    makeApiRequest: vi.fn().mockResolvedValue({ success: true, data: [], headers: {} }),
    getCurrentUser: vi.fn().mockResolvedValue({ email: 'admin@example.com', id: 'admin' }),
    checkCancelled: vi.fn(),
    resetCancellation: vi.fn(),
    runOperation: vi.fn(),
    callbacks: {},
    ...overrides,
  } as CoreApi;
}

describe('getAppPushGroupMappings boundary validation', () => {
  it('drops malformed assignment rows leniently and maps the valid ones', async () => {
    const valid = {
      id: '00gFAKE1',
      priority: 0,
      profile: { name: 'Pushed Group' },
      _links: { group: { href: 'https://example.okta.com/api/v1/groups/00gFAKE1' } },
    };
    // Numeric `id` fails the schema — the lenient list parser drops the row.
    const malformed = { id: 12345 };
    const makeApiRequest = vi.fn().mockResolvedValue({
      success: true,
      data: [valid, malformed],
      headers: {},
    });
    const core = makeCore({ makeApiRequest });
    const { getAppPushGroupMappings } = createPushGroupOperations(core);

    const mappings = await getAppPushGroupMappings('0oaFAKE1', 'Fake App');

    expect(makeApiRequest).toHaveBeenCalledWith(
      '/api/v1/apps/0oaFAKE1/groups?limit=200',
      'GET',
      undefined,
      'low',
    );
    expect(mappings).toEqual([
      {
        mappingId: '00gFAKE1',
        sourceUserGroupId: '00gFAKE1',
        targetGroupName: 'Pushed Group',
        status: 'ACTIVE',
        appId: '0oaFAKE1',
        appName: 'Fake App',
      },
    ]);
  });
});
