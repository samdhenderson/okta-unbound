/**
 * @module hooks/useOktaApi/exportEngine
 * @description The descriptor-driven Export Engine operations.
 *
 * Reads any Okta collection over the rate-limited scheduler path (paginating via
 * the `Link` header), validates each page in the side panel with
 * {@link parseOktaList} (the generic `makeApiRequest` path returns raw JSON), then
 * projects the chosen columns to an escaped CSV and downloads it. Adding an entity
 * is writing an {@link EntityExport} descriptor — this engine never changes.
 *
 * @see {@link module:sidepanel/export/types} for the descriptor contract.
 */

import type { CoreApi } from './core';
import type { AuditLogEntry } from './types';
import type { EntityExport, CellValue } from '@/sidepanel/export/types';
import { parseNextLink, nextPageUrl } from '@/shared/utils/oktaPagination';
import { openingWalkEstimate, refinedWalkEstimate } from '@/shared/scheduler/planEstimate';
import { parseOktaList } from '@/shared/schemas/okta';
import {
  generateCSV,
  downloadCSV,
  sanitizeFilename,
  getDateForFilename,
} from '@/shared/utils/csvUtils';
import { auditStore } from '@/shared/storage/auditStore';
import { createLogger } from '@/shared/utils/logger';

const log = createLogger('useOktaApi');

/** Default hard cap on rows fetched per export when a descriptor sets no `maxRows`. */
const DEFAULT_MAX_ROWS = 50_000;

/** Result of a paginated export read. */
export interface FetchAllResult<Row> {
  /** Validated rows (malformed rows dropped and counted in `dropped`). */
  rows: Row[];
  /** Total raw rows the server returned across all pages (before validation). */
  fetched: number;
  /** How many rows failed schema validation and were skipped. */
  dropped: number;
  /** Whether the `maxRows` cap was hit before pagination finished. */
  capped: boolean;
}

/** A cheap first-page probe used for the live match-count. */
export interface CountResult {
  /** Rows on the first page (0 reveals a filter typo). */
  count: number;
  /** Whether more pages exist beyond the first (so the true total is larger). */
  hasMore: boolean;
}

/** Arguments for {@link createExportEngineOperations}'s `runExport`. */
export interface RunExportArgs<Row> {
  /** The descriptor being exported. */
  descriptor: EntityExport<Row>;
  /** Already-fetched, validated rows (preview reuses these; no refetch). */
  rows: Row[];
  /** Ids of the columns to include, in catalog order. */
  enabledColumnIds: string[];
  /** Optional label (e.g. a group name) folded into the filename. */
  contextLabel?: string;
}

/**
 * Build the export-engine operations bound to a {@link CoreApi} transport.
 *
 * @param coreApi - Shared transport surface (scheduler-routed requests + audit).
 * @returns `{ fetchAllRows, countRows, runExport }`.
 */
export function createExportEngineOperations(coreApi: CoreApi) {
  /**
   * Fetch every row for a resolved endpoint, paginating on the `Link` header.
   *
   * Uses `'low'` priority so bulk export reads never starve interactive UI, checks
   * cancellation between pages, and validates each page in the side panel.
   *
   * @param descriptor - The entity descriptor (supplies the schema and cap).
   * @param resolvedEndpoint - First-page endpoint from `buildExportEndpoint`.
   * @param onPage - Optional callback with the running row count after each page.
   * @returns Validated rows plus dropped/capped diagnostics.
   */
  const fetchAllRows = async <Row>(
    descriptor: EntityExport<Row>,
    resolvedEndpoint: string,
    onPage?: (rowsSoFar: number) => void,
  ): Promise<FetchAllResult<Row>> => {
    const cap = descriptor.maxRows ?? DEFAULT_MAX_ROWS;
    const context = `EXPORT ${descriptor.id}`;

    // An export is the extension's longest walk and the one whose length is
    // least knowable in advance: the filter decides how many rows match. So it
    // declares a floor of one page and raises it as each page's `Link` header
    // promises another, settling to an exact count when the walk ends
    // (ADR-0060 §1). No probe request is spent to learn the total.
    return coreApi.withPlan(
      `Export: ${descriptor.displayName}`,
      [{ endpoint: resolvedEndpoint, method: 'GET', estimate: openingWalkEstimate() }],
      async (plan) => {
        const rows: Row[] = [];
        let fetched = 0;
        let dropped = 0;
        let capped = false;
        let pages = 0;
        let nextUrl: string | null = resolvedEndpoint;

        while (nextUrl) {
          coreApi.checkCancelled();
          const response = await coreApi.makeApiRequest(nextUrl, {
            method: 'GET',
            priority: 'low',
            reason: `Export: ${descriptor.displayName}`,
            planId: plan.planId,
          });
          if (!response.success) {
            throw new Error(response.error || `Export fetch failed (${descriptor.id})`);
          }
          pages++;

          const rawLength = Array.isArray(response.data) ? response.data.length : 0;
          fetched += rawLength;
          const page = parseOktaList(descriptor.schema, response.data, context) as Row[];
          dropped += rawLength - page.length;
          rows.push(...page);
          onPage?.(rows.length);
          coreApi.callbacks.onResult?.({ message: `Loaded ${rows.length} rows…`, type: 'info' });

          if (rows.length >= cap) {
            capped = true;
            rows.length = cap;
            break;
          }
          // Guarded: stops on an empty page or a non-advancing rel="next" cursor,
          // keyed off the RAW page length so an all-malformed page still advances.
          nextUrl = nextPageUrl(nextUrl, response.headers?.link, rawLength);
          plan.refine(resolvedEndpoint, refinedWalkEstimate(pages, nextUrl !== null));
        }

        // Hitting the row cap ends the walk too, and the estimate has to agree
        // — otherwise the bar would keep promising pages the cap just cancelled.
        if (capped) plan.refine(resolvedEndpoint, refinedWalkEstimate(pages, false));

        return { rows, fetched, dropped, capped };
      },
    );
  };

  /**
   * Probe the first page for the live match-count under the filter box.
   *
   * Deliberately fetches a single page (cheap on every keystroke); a `count` of 0
   * surfaces a filter typo, and `hasMore` signals the true total is larger.
   *
   * @param descriptor - The entity descriptor (for its schema).
   * @param resolvedEndpoint - First-page endpoint from `buildExportEndpoint`.
   * @returns First-page count and whether more pages exist.
   */
  const countRows = async <Row>(
    descriptor: EntityExport<Row>,
    resolvedEndpoint: string,
  ): Promise<CountResult> => {
    const response = await coreApi.makeApiRequest(resolvedEndpoint, {
      method: 'GET',
      priority: 'low',
      reason: `Count matches: ${descriptor.displayName}`,
    });
    if (!response.success) {
      throw new Error(response.error || `Count failed (${descriptor.id})`);
    }
    const page = parseOktaList(descriptor.schema, response.data, `COUNT ${descriptor.id}`);
    return { count: page.length, hasMore: parseNextLink(response.headers?.link) !== null };
  };

  /**
   * Project rows through the enabled columns, download the CSV, and audit it.
   *
   * @param args - Descriptor, fetched rows, enabled column ids, optional label.
   */
  const runExport = async <Row>(args: RunExportArgs<Row>): Promise<void> => {
    const { descriptor, rows, enabledColumnIds, contextLabel } = args;
    const startTime = Date.now();

    const columns = descriptor.columnCatalog.filter((column) =>
      enabledColumnIds.includes(column.id),
    );
    const headers = columns.map((column) => column.label);
    const dataRows: CellValue[][] = rows.map((row) =>
      columns.map((column) => {
        const raw = column.accessor(row);
        if (column.format) return column.format(raw, row);
        return raw == null ? '' : String(raw);
      }),
    );

    const csv = generateCSV(headers, dataRows);
    const stem = sanitizeFilename(contextLabel ?? descriptor.displayName);
    downloadCSV(csv, `${stem}-${descriptor.id}-${getDateForFilename()}.csv`);

    await logExportAudit(coreApi, descriptor, rows.length, startTime);
  };

  return { fetchAllRows, countRows, runExport };
}

/**
 * Record a successful export to the audit trail (fire-and-forget).
 *
 * Mirrors {@link module:hooks/useOktaApi/exportOperations}: `action: 'export'`,
 * no users modified, actor from `/users/me`. Audit-write failures are swallowed.
 * An unresolved actor is recorded as `performedBy: null` /
 * `actorResolution: 'unavailable'` — never as a placeholder identity.
 */
async function logExportAudit(
  coreApi: CoreApi,
  descriptor: EntityExport,
  rowCount: number,
  startTime: number,
): Promise<void> {
  try {
    const actor = await coreApi.getCurrentUser();
    const entry: AuditLogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      action: 'export',
      groupId: descriptor.id,
      groupName: descriptor.displayName,
      performedBy: actor.kind === 'resolved' ? actor.email : null,
      actorResolution: actor.kind === 'resolved' ? 'resolved' : 'unavailable',
      affectedUsers: [],
      result: 'success',
      details: {
        usersSucceeded: rowCount,
        usersFailed: 0,
        apiRequestCount: 1,
        durationMs: Date.now() - startTime,
      },
    };
    auditStore.logOperation(entry).catch((err) => log.error('Failed to log export audit:', err));
  } catch (err) {
    log.error('Failed to build export audit entry:', err);
  }
}
