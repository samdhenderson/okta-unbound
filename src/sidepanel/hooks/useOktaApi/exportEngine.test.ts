/**
 * @module hooks/useOktaApi/exportEngine.test
 * @description Unit tests for the descriptor-driven Export Engine data layer.
 *
 * Pins the non-UI behavior of {@link createExportEngineOperations}: `Link`-header
 * pagination, per-page zod validation (malformed rows dropped and counted), the
 * `maxRows` cap, cancellation between pages, transport-failure surfacing, the
 * cheap first-page `countRows` probe, and `runExport`'s catalog-ordered CSV
 * projection + filename + fire-and-forget audit write. The transport
 * (`CoreApi`), the CSV download, and the audit store are mocked; the real lenient
 * `oktaUserListItemSchema` drives validation so the tests exercise the true
 * boundary contract.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createExportEngineOperations } from './exportEngine';
import type { CoreApi } from './core';
import type { EntityExport, ExportColumn } from '@/sidepanel/export/types';
import { oktaUserListItemSchema, type OktaUserListItem } from '@/shared/schemas/okta';
import { OperationCancelledError } from '@/shared/scheduler/cancellation';
import { downloadCSV } from '@/shared/utils/csvUtils';
import { auditStore } from '@/shared/storage/auditStore';

// Keep the real CSV assembly/filename helpers (we assert on their output), but
// stub the browser download so no DOM/object-URL work happens under test.
vi.mock('@/shared/utils/csvUtils', async (importActual) => {
  const actual = await importActual<typeof import('@/shared/utils/csvUtils')>();
  return { ...actual, downloadCSV: vi.fn() };
});

// The audit trail is fire-and-forget; mock it so we can assert the logged entry
// without touching IndexedDB.
vi.mock('@/shared/storage/auditStore', () => ({
  auditStore: { logOperation: vi.fn().mockResolvedValue(undefined) },
}));

const mockedDownloadCSV = vi.mocked(downloadCSV);
const mockedAuditStore = vi.mocked(auditStore);

/** Flush pending microtasks so the fire-and-forget audit write settles. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Build a schema-valid list-item user row with a fake, non-PII identifier. */
function makeUser(id: string, overrides: Record<string, unknown> = {}): OktaUserListItem {
  return {
    id,
    status: 'ACTIVE',
    created: '2026-01-02T00:00:00.000Z',
    lastLogin: '2026-02-03T00:00:00.000Z',
    profile: {
      login: `${id}@example.com`,
      email: `${id}@example.com`,
      firstName: 'Test',
      lastName: 'User',
    },
    ...overrides,
  } as OktaUserListItem;
}

/** A 3-column catalog with a `format` column, to prove formatting + catalog order. */
const catalog: ExportColumn<OktaUserListItem>[] = [
  { id: 'id', label: 'User ID', group: 'base', defaultEnabled: true, accessor: (u) => u.id },
  {
    id: 'status',
    label: 'Status',
    group: 'base',
    defaultEnabled: true,
    accessor: (u) => u.status,
    // Distinctive prefix so the assertion fails if the formatter is skipped.
    format: (v) => `status:${String(v)}`,
  },
  {
    id: 'email',
    label: 'Email',
    group: 'profile',
    defaultEnabled: true,
    accessor: (u) => u.profile?.email,
  },
];

/** Build an in-test whole-org descriptor over the real user list-item schema. */
function makeDescriptor(
  overrides: Partial<EntityExport<OktaUserListItem>> = {},
): EntityExport<OktaUserListItem> {
  return {
    id: 'users',
    displayName: 'My Users',
    icon: 'user',
    description: 'test descriptor',
    context: { kind: 'whole-org' },
    endpoint: '/api/v1/users',
    defaultQuery: { limit: 200 },
    schema: oktaUserListItemSchema,
    filter: { kind: 'none' },
    columnCatalog: catalog,
    ...overrides,
  };
}

/** A `rel="next"` Link header pointing at the given origin-relative path. */
function nextLink(path: string): string {
  return `<https://acme.okta.com${path}>; rel="next"`;
}

/** Build a fully-mocked CoreApi; override only what a test cares about. */
function makeCore(overrides: Partial<CoreApi> = {}): CoreApi {
  return {
    targetTabId: 1,
    sendMessage: vi.fn(),
    makeApiRequest: vi.fn().mockResolvedValue({ success: true, data: [], headers: {} }),
    getCurrentUser: vi.fn().mockResolvedValue({ email: 'admin@example.com', id: '00uFAKEADMIN' }),
    checkCancelled: vi.fn(),
    resetCancellation: vi.fn(),
    runOperation: vi.fn(),
    callbacks: {},
    ...overrides,
  } as CoreApi;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedAuditStore.logOperation.mockResolvedValue(undefined);
});

describe('fetchAllRows pagination', () => {
  it('follows the rel="next" Link across pages, concatenates, and stops', async () => {
    const makeApiRequest = vi
      .fn()
      .mockResolvedValueOnce({
        success: true,
        data: [makeUser('00uFAKE1'), makeUser('00uFAKE2')],
        headers: { link: nextLink('/api/v1/users?after=cursor2') },
      })
      .mockResolvedValueOnce({
        success: true,
        data: [makeUser('00uFAKE3')],
        headers: {},
      });
    const core = makeCore({ makeApiRequest });
    const { fetchAllRows } = createExportEngineOperations(core);

    const result = await fetchAllRows(makeDescriptor(), '/api/v1/users?limit=200');

    expect(result.rows.map((r) => r.id)).toEqual(['00uFAKE1', '00uFAKE2', '00uFAKE3']);
    expect(result.dropped).toBe(0);
    expect(result.capped).toBe(false);
    // Two pages fetched, the second at the parsed origin-relative next path.
    expect(makeApiRequest).toHaveBeenCalledTimes(2);
    expect(makeApiRequest).toHaveBeenNthCalledWith(
      1,
      '/api/v1/users?limit=200',
      'GET',
      undefined,
      'low',
    );
    expect(makeApiRequest).toHaveBeenNthCalledWith(
      2,
      '/api/v1/users?after=cursor2',
      'GET',
      undefined,
      'low',
    );
  });

  it('drops malformed rows and counts them without failing the page', async () => {
    // One row is missing the required `id` — the lenient list parser drops it.
    const malformed = { status: 'ACTIVE', profile: makeUser('x').profile };
    const makeApiRequest = vi.fn().mockResolvedValueOnce({
      success: true,
      data: [makeUser('00uFAKE1'), malformed, makeUser('00uFAKE2')],
      headers: {},
    });
    const core = makeCore({ makeApiRequest });
    const { fetchAllRows } = createExportEngineOperations(core);

    const result = await fetchAllRows(makeDescriptor(), '/api/v1/users');

    expect(result.rows.map((r) => r.id)).toEqual(['00uFAKE1', '00uFAKE2']);
    expect(result.dropped).toBe(1);
  });

  it('caps rows at descriptor.maxRows and reports capped', async () => {
    const page = [1, 2, 3, 4, 5].map((n) => makeUser(`00uFAKE${n}`));
    const makeApiRequest = vi.fn().mockResolvedValueOnce({
      success: true,
      data: page,
      headers: { link: nextLink('/api/v1/users?after=more') },
    });
    const core = makeCore({ makeApiRequest });
    const { fetchAllRows } = createExportEngineOperations(core);

    const result = await fetchAllRows(makeDescriptor({ maxRows: 2 }), '/api/v1/users');

    expect(result.rows).toHaveLength(2);
    expect(result.capped).toBe(true);
    // The cap short-circuits pagination even though a next link was present.
    expect(makeApiRequest).toHaveBeenCalledTimes(1);
  });

  it('rejects with OperationCancelledError when cancelled between pages, discarding partial work', async () => {
    const checkCancelled = vi
      .fn()
      .mockImplementationOnce(() => {})
      .mockImplementationOnce(() => {
        throw new OperationCancelledError();
      });
    const makeApiRequest = vi.fn().mockResolvedValueOnce({
      success: true,
      data: [makeUser('00uFAKE1')],
      headers: { link: nextLink('/api/v1/users?after=cursor2') },
    });
    const core = makeCore({ makeApiRequest, checkCancelled });
    const { fetchAllRows } = createExportEngineOperations(core);

    await expect(fetchAllRows(makeDescriptor(), '/api/v1/users')).rejects.toBeInstanceOf(
      OperationCancelledError,
    );
    // Only the first page was fetched before the cancel tripped on iteration two.
    expect(makeApiRequest).toHaveBeenCalledTimes(1);
  });

  it('throws with the transport error when a page fails', async () => {
    const makeApiRequest = vi.fn().mockResolvedValueOnce({ success: false, error: 'rate limited' });
    const core = makeCore({ makeApiRequest });
    const { fetchAllRows } = createExportEngineOperations(core);

    await expect(fetchAllRows(makeDescriptor(), '/api/v1/users')).rejects.toThrow('rate limited');
  });
});

describe('countRows first-page probe', () => {
  it('returns the first-page count with hasMore:true when a next link exists', async () => {
    const makeApiRequest = vi.fn().mockResolvedValueOnce({
      success: true,
      data: [makeUser('00uFAKE1'), makeUser('00uFAKE2')],
      headers: { link: nextLink('/api/v1/users?after=cursor2') },
    });
    const core = makeCore({ makeApiRequest });
    const { countRows } = createExportEngineOperations(core);

    expect(await countRows(makeDescriptor(), '/api/v1/users')).toEqual({ count: 2, hasMore: true });
    // A single page is probed regardless of pagination.
    expect(makeApiRequest).toHaveBeenCalledTimes(1);
  });

  it('reports hasMore:false when there is no next link', async () => {
    const makeApiRequest = vi.fn().mockResolvedValueOnce({
      success: true,
      data: [makeUser('00uFAKE1')],
      headers: {},
    });
    const core = makeCore({ makeApiRequest });
    const { countRows } = createExportEngineOperations(core);

    expect(await countRows(makeDescriptor(), '/api/v1/users')).toEqual({
      count: 1,
      hasMore: false,
    });
  });

  it('reports count:0 for an empty page (a filter typo)', async () => {
    const makeApiRequest = vi.fn().mockResolvedValueOnce({ success: true, data: [], headers: {} });
    const core = makeCore({ makeApiRequest });
    const { countRows } = createExportEngineOperations(core);

    expect(await countRows(makeDescriptor(), '/api/v1/users')).toEqual({
      count: 0,
      hasMore: false,
    });
  });

  it('throws with the transport error when the probe fails', async () => {
    const makeApiRequest = vi.fn().mockResolvedValueOnce({ success: false, error: 'boom' });
    const core = makeCore({ makeApiRequest });
    const { countRows } = createExportEngineOperations(core);

    await expect(countRows(makeDescriptor(), '/api/v1/users')).rejects.toThrow('boom');
  });
});

describe('runExport CSV projection + audit', () => {
  it('downloads a catalog-ordered, formatted CSV and logs one success audit entry', async () => {
    const core = makeCore();
    const { runExport } = createExportEngineOperations(core);
    const rows = [makeUser('00uFAKE1'), makeUser('00uFAKE2')];

    await runExport({
      descriptor: makeDescriptor(),
      rows,
      // Deliberately reversed and a subset: output must follow catalog order
      // (id, status) and exclude the un-enabled `email` column.
      enabledColumnIds: ['status', 'id'],
    });
    await flush();

    expect(mockedDownloadCSV).toHaveBeenCalledTimes(1);
    const [csv, filename] = mockedDownloadCSV.mock.calls[0];
    const lines = csv.split('\n');
    expect(lines[0]).toBe('User ID,Status');
    // Formatter ran (`status:` prefix) and email is absent.
    expect(lines[1]).toBe('00uFAKE1,status:ACTIVE');
    expect(lines[2]).toBe('00uFAKE2,status:ACTIVE');
    // <stem>-<id>-<date>.csv, stem from the descriptor displayName.
    expect(filename).toMatch(/^my_users-users-\d{4}-\d{2}-\d{2}\.csv$/);

    expect(mockedAuditStore.logOperation).toHaveBeenCalledTimes(1);
    const entry = mockedAuditStore.logOperation.mock.calls[0][0];
    expect(entry.action).toBe('export');
    expect(entry.result).toBe('success');
    expect(entry.details.usersSucceeded).toBe(rows.length);
  });

  it('folds a contextLabel into the filename stem', async () => {
    const core = makeCore();
    const { runExport } = createExportEngineOperations(core);

    await runExport({
      descriptor: makeDescriptor(),
      rows: [makeUser('00uFAKE1')],
      enabledColumnIds: ['id'],
      contextLabel: 'Sales Team',
    });
    await flush();

    const [, filename] = mockedDownloadCSV.mock.calls[0];
    expect(filename).toMatch(/^sales_team-users-\d{4}-\d{2}-\d{2}\.csv$/);
  });
});
