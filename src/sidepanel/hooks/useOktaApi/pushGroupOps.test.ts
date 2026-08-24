/**
 * Tests for the push-group mapping operations: zod validation at the response
 * boundary (ADR-0006) — malformed assignment rows are dropped leniently by
 * `parseOktaList`, never thrown on, while valid rows still map to
 * `PushGroupMapping` records; and the single-app label lookup parses strictly
 * with `oktaAppListItemSchema` before its label can be rendered as an app name
 * (D-020), degrading to the app's raw id when it cannot.
 *
 * Fixtures use only fake placeholders (`0oaFAKE…`, `00gFAKE…`,
 * `example.okta.com`) per CLAUDE.md.
 */
import { describe, it, expect, vi } from 'vitest';
import { createPushGroupOperations } from './pushGroupOps';
import type { CoreApi } from './core';
import type { GroupSummary } from '../../../shared/types';
import { makeFakeCore, sequentialRunOperation } from '@/test/factories/coreApi';

/** Build a fake CoreApi whose runOperation actually drives the per-item task. */
const makeCore = (overrides: Partial<CoreApi> = {}): CoreApi =>
  makeFakeCore({ runOperation: sequentialRunOperation(), ...overrides });

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
    // No `status`: the endpoint returns none, so none is synthesized. Okta's
    // real `priority` is carried through verbatim instead.
    expect(mappings).toEqual([
      {
        mappingId: '00gFAKE1',
        sourceUserGroupId: '00gFAKE1',
        targetGroupName: 'Pushed Group',
        priority: 0,
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
        // `id` is what Okta actually returns and what the boundary schema
        // requires (D-020); the fixture omitted it while the response went
        // unvalidated. The assertions below are unchanged.
        return { success: true, data: { id: '0oaFAKE1', label: 'Fake App' } };
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

  it('skips the label lookup for an app the groups walk already named', async () => {
    // ADR-0040 puts `expand=app` on the org's group walk, so Okta embeds the
    // source app and `toGroupSummary` reads the name off it before this pass
    // ever runs. Asking again cost one round trip per unique source app — about
    // half this pass's request budget in a large org — to re-learn a name the
    // list was already displaying.
    const assignment = {
      id: '00gFAKE1',
      priority: 0,
      profile: { name: 'Pushed Group' },
      _links: { group: { href: 'https://example.okta.com/api/v1/groups/00gFAKE1' } },
    };
    const makeApiRequest = vi.fn(async (endpoint: string) => {
      if (endpoint.startsWith('/api/v1/apps/0oaFAKE1/groups')) {
        return { success: true, data: [assignment], headers: {} };
      }
      // Reaching `/api/v1/apps/0oaFAKE1` is the regression this pins.
      throw new Error(`Unrouted test endpoint: ${endpoint}`);
    });
    const core = makeCore({ makeApiRequest });
    const { applyPushGroupMappings } = createPushGroupOperations(core);

    const result = await applyPushGroupMappings([appGroup({ sourceAppName: 'Fake App' })]);

    // Only the mapping phase runs; the name phase has nothing left to ask.
    expect(core.runOperation).toHaveBeenCalledTimes(1);
    expect(makeApiRequest).not.toHaveBeenCalledWith(
      '/api/v1/apps/0oaFAKE1',
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );
    // The embed's name still reaches the mappings it labels.
    expect(result[0].sourceAppName).toBe('Fake App');
    expect(result[0].pushMappings).toEqual([
      expect.objectContaining({ sourceUserGroupId: '00gFAKE1', appName: 'Fake App' }),
    ]);
  });

  it('returns the input untouched when no APP_GROUP sources are present', async () => {
    const core = makeCore();
    const { applyPushGroupMappings } = createPushGroupOperations(core);
    const groups = [appGroup({ type: 'OKTA_GROUP', sourceAppId: undefined })];

    const result = await applyPushGroupMappings(groups);

    expect(result).toBe(groups);
    expect(core.runOperation).not.toHaveBeenCalled();
  });

  // D-003: a per-app label lookup that throws keeps the existing name (the raw
  // app id), so the only way to diagnose a systemic resolution failure is the
  // log line. Spying on `console.error` — the shared logger's sink — matches how
  // logging is asserted elsewhere in the repo (`src/content/index.test.ts`).
  it('logs the failed app id when app-label resolution throws, keeping the existing name', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const makeApiRequest = vi.fn(async (endpoint: string) => {
      if (endpoint === '/api/v1/apps/0oaFAKE1') {
        throw new Error('Request failed');
      }
      if (endpoint.startsWith('/api/v1/apps/0oaFAKE1/groups')) {
        return { success: true, data: [], headers: {} };
      }
      throw new Error(`Unrouted test endpoint: ${endpoint}`);
    });
    const core = makeCore({ makeApiRequest });
    const { applyPushGroupMappings } = createPushGroupOperations(core);

    const result = await applyPushGroupMappings([appGroup()]);

    // The name stays unresolved either way — that is the intended degrade.
    expect(result[0].sourceAppName).toBeUndefined();

    const logged = consoleError.mock.calls
      .flat()
      .map((arg) => (typeof arg === 'string' ? arg : String(arg)))
      .join(' ');
    expect(logged).toContain('Failed to resolve app name for app 0oaFAKE1');
    // Identifiers and outcomes only — no response payload reaches the log.
    expect(logged).not.toContain('Pushed Group');
    consoleError.mockRestore();
  });

  // D-019: the two non-throwing halves of the same block. A scheduler-level 401
  // or 429 resolves with `success: false` rather than throwing, so it never
  // reached the catch D-003 added and left no trace at all.
  it('logs the app id and status when app-label resolution resolves with success: false', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const makeApiRequest = vi.fn(async (endpoint: string) => {
      if (endpoint === '/api/v1/apps/0oaFAKE1') {
        // Shape of a rate-limited scheduler response: resolved, not thrown.
        return { success: false, status: 429, error: 'Rate limit exceeded for example.okta.com' };
      }
      if (endpoint.startsWith('/api/v1/apps/0oaFAKE1/groups')) {
        return { success: true, data: [], headers: {} };
      }
      throw new Error(`Unrouted test endpoint: ${endpoint}`);
    });
    const core = makeCore({ makeApiRequest });
    const { applyPushGroupMappings } = createPushGroupOperations(core);

    const result = await applyPushGroupMappings([appGroup()]);

    // Unchanged degrade: the app stays on its raw id.
    expect(result[0].sourceAppName).toBeUndefined();
    expect(consoleError).toHaveBeenCalledWith(
      '[pushGroupOps]',
      'App name resolution request failed',
      {
        code: 'resolve_app_name_request_failed',
        appId: '0oaFAKE1',
        status: 429,
      },
    );
    // Identifiers and outcomes only: the server's error string never lands in
    // the log, because it can carry payload text.
    const serialized = JSON.stringify(consoleError.mock.calls);
    expect(serialized).not.toContain('Rate limit exceeded');
    expect(serialized).not.toContain('example.okta.com');
    consoleError.mockRestore();
  });

  it('logs the app id when a 200 carries neither label nor name', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const makeApiRequest = vi.fn(async (endpoint: string) => {
      if (endpoint === '/api/v1/apps/0oaFAKE1') {
        return { success: true, data: { id: '0oaFAKE1', status: 'ACTIVE' } };
      }
      if (endpoint.startsWith('/api/v1/apps/0oaFAKE1/groups')) {
        return { success: true, data: [], headers: {} };
      }
      throw new Error(`Unrouted test endpoint: ${endpoint}`);
    });
    const core = makeCore({ makeApiRequest });
    const { applyPushGroupMappings } = createPushGroupOperations(core);

    const result = await applyPushGroupMappings([appGroup()]);

    expect(result[0].sourceAppName).toBeUndefined();
    // Distinct from the request-failure line above, so a log reader can tell
    // "the request failed" from "the app has no label".
    expect(consoleError).toHaveBeenCalledWith(
      '[pushGroupOps]',
      'App name resolution returned no label',
      { code: 'resolve_app_name_no_label', appId: '0oaFAKE1' },
    );
    // No response body reaches the log.
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain('ACTIVE');
    consoleError.mockRestore();
  });

  // D-020 (pinning): the label lookup is an Okta response like any other, so it
  // must be validated at the boundary (ADR-0006) before its `label` is rendered
  // as an app name. `oktaAppListItemSchema` catches a non-string `label` to
  // `undefined`, so a malformed one degrades to "no label" — the same degrade as
  // a 200 with no label at all — instead of reaching the DOM.
  it('drops a non-string label at the response boundary instead of rendering it', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const makeApiRequest = vi.fn(async (endpoint: string) => {
      if (endpoint === '/api/v1/apps/0oaFAKE1') {
        // Okta is untrusted: nothing guarantees `label` is a string.
        return { success: true, data: { id: '0oaFAKE1', label: 12345 } };
      }
      if (endpoint.startsWith('/api/v1/apps/0oaFAKE1/groups')) {
        return { success: true, data: [], headers: {} };
      }
      throw new Error(`Unrouted test endpoint: ${endpoint}`);
    });
    const core = makeCore({ makeApiRequest });
    const { applyPushGroupMappings } = createPushGroupOperations(core);

    const result = await applyPushGroupMappings([appGroup()]);

    expect(result[0].sourceAppName).toBeUndefined();
    expect(consoleError).toHaveBeenCalledWith(
      '[pushGroupOps]',
      'App name resolution returned no label',
      { code: 'resolve_app_name_no_label', appId: '0oaFAKE1' },
    );
    consoleError.mockRestore();
  });

  // D-020 (pinning): the id is interpolated into a path, so it is encoded —
  // matching `getAppById`, which resolves the identical endpoint.
  it('encodes the app id in the label-lookup path', async () => {
    const makeApiRequest = vi.fn(async (endpoint: string) => {
      if (endpoint.includes('/groups')) {
        return { success: true, data: [], headers: {} };
      }
      return { success: true, data: { id: '0oaFAKE 1', label: 'Fake App' } };
    });
    const core = makeCore({ makeApiRequest });
    const { applyPushGroupMappings } = createPushGroupOperations(core);

    const result = await applyPushGroupMappings([appGroup({ sourceAppId: '0oaFAKE 1' })]);

    expect(makeApiRequest).toHaveBeenCalledWith(
      '/api/v1/apps/0oaFAKE%201',
      'GET',
      undefined,
      'low',
    );
    // The resolvable app still resolves — encoding changes the wire path only.
    expect(result[0].sourceAppName).toBe('Fake App');
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
