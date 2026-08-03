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
import type { GroupSummary } from '../../../shared/types';

/** Build a fake CoreApi whose runOperation actually drives the per-item task. */
function makeCore(overrides: Partial<CoreApi> = {}): CoreApi {
  return {
    targetTabId: 1,
    sendMessage: vi.fn(),
    makeApiRequest: vi.fn().mockResolvedValue({ success: true, data: [], headers: {} }),
    getCurrentUser: vi.fn().mockResolvedValue({ email: 'admin@example.com', id: 'admin' }),
    checkCancelled: vi.fn(),
    resetCancellation: vi.fn(),
    runOperation: vi.fn(
      async (
        _name: string,
        items: unknown[],
        task: (item: unknown, index: number) => Promise<unknown>,
      ) => {
        const results: Array<{
          item: unknown;
          index: number;
          status: string;
          value?: unknown;
          error?: unknown;
        }> = [];
        let completed = 0;
        let failed = 0;
        for (let i = 0; i < items.length; i++) {
          try {
            const value = await task(items[i], i);
            results.push({ item: items[i], index: i, status: 'fulfilled', value });
            completed++;
          } catch (error) {
            results.push({ item: items[i], index: i, status: 'rejected', error });
            failed++;
          }
        }
        return {
          results,
          total: items.length,
          completed,
          failed,
          skipped: 0,
          stoppedByError: false,
          cancelled: false,
        };
      },
    ),
    callbacks: {},
    ...overrides,
  } as unknown as CoreApi;
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

/** An APP_GROUP summary sourced from the fake app. */
function appGroup(over: Partial<GroupSummary> = {}): GroupSummary {
  return {
    id: '00gFAKE1',
    name: 'Pushed Group',
    type: 'APP_GROUP',
    sourceAppId: '0oaFAKE1',
    memberCount: 0,
    ...over,
  } as GroupSummary;
}

describe('applyPushGroupMappings', () => {
  it('resolves app names and attaches mappings via the operation runner', async () => {
    const assignment = {
      id: '00gFAKE1',
      priority: 0,
      profile: { name: 'Pushed Group' },
      _links: { group: { href: 'https://example.okta.com/api/v1/groups/00gFAKE1' } },
    };
    const makeApiRequest = vi.fn(async (endpoint: string) => {
      if (endpoint === '/api/v1/apps/0oaFAKE1') {
        return { success: true, data: { label: 'Fake App' } };
      }
      if (endpoint.startsWith('/api/v1/apps/0oaFAKE1/groups')) {
        return { success: true, data: [assignment], headers: {} };
      }
      throw new Error(`Unrouted test endpoint: ${endpoint}`);
    });
    const core = makeCore({ makeApiRequest });
    const { applyPushGroupMappings } = createPushGroupOperations(core);
    const onProgress = vi.fn();

    const result = await applyPushGroupMappings([appGroup()], onProgress);

    expect(core.runOperation).toHaveBeenCalledTimes(2); // names, then mappings
    expect(result[0].sourceAppName).toBe('Fake App');
    expect(result[0].pushMappings).toEqual([
      expect.objectContaining({ sourceUserGroupId: '00gFAKE1', appName: 'Fake App' }),
    ]);
    expect(onProgress).toHaveBeenCalledWith(1, 1);
  });

  it('returns the input untouched when no APP_GROUP sources are present', async () => {
    const core = makeCore();
    const { applyPushGroupMappings } = createPushGroupOperations(core);
    const groups = [appGroup({ type: 'OKTA_GROUP', sourceAppId: undefined })];

    const result = await applyPushGroupMappings(groups);

    expect(result).toBe(groups);
    expect(core.runOperation).not.toHaveBeenCalled();
  });

  // ADR-0009 adoption: a cancel mid-run must not throw — the groups are
  // returned enriched with whatever resolved before the cancel (here: nothing).
  it('returns groups without enrichment when the run is cancelled before any app resolves', async () => {
    const cancelledOutcome = {
      results: [],
      total: 1,
      completed: 0,
      failed: 0,
      skipped: 1,
      stoppedByError: false,
      cancelled: true,
    };
    const runOperation = vi
      .fn()
      .mockResolvedValue(cancelledOutcome) as unknown as CoreApi['runOperation'];
    const core = makeCore({ runOperation });
    const { applyPushGroupMappings } = createPushGroupOperations(core);
    const groups = [appGroup()];

    const result = await applyPushGroupMappings(groups);

    // Same group reference: no updates were applicable.
    expect(result[0]).toBe(groups[0]);
    expect(result[0].pushMappings).toBeUndefined();
  });
});
