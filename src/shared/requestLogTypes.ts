/**
 * @module shared/requestLogTypes
 * @description Type definitions for the verbose API request audit log.
 *
 * Declares {@link RequestLogEntry}, one row per batch of Okta API calls that
 * shared a reason (a batch of one request is still one entry), and the
 * {@link RequestLogHistory} container. Consumed by `shared/requestLog` (writer,
 * background) and `AuditLogViewer` (reader, side panel).
 */

/** One distinct endpoint+method pair captured within a batch. */
export interface RequestLogEndpoint {
  method: string;
  /** Okta path, redacted via `shared/utils/redact` before it reached storage. */
  endpoint: string;
}

/** How many of a batch's requests ultimately succeeded. */
export type RequestLogOutcome = 'all' | 'partial' | 'none';

/** One recorded batch of API requests that shared a reason. */
export interface RequestLogEntry {
  id: string;
  /** Epoch millis when the batch's first request was scheduled. */
  timestamp: number;
  /** Human-readable "why", e.g. "Load group members". */
  reason: string;
  /** Total requests folded into this batch. */
  requestCount: number;
  /**
   * Distinct endpoint+method pairs, deduped and capped at
   * `MAX_LOGGED_ENDPOINTS` (`shared/requestLog`) — see {@link endpointsTruncated}.
   */
  endpoints: RequestLogEndpoint[];
  /** True when the batch had more distinct endpoints than `endpoints` shows. */
  endpointsTruncated: boolean;
  /** Wall-clock span from the first request scheduled to the last settling, in ms. */
  durationMs: number;
  outcome: RequestLogOutcome;
}

/** The persisted log container: recent batches plus its size cap. */
export interface RequestLogHistory {
  entries: RequestLogEntry[];
  maxSize: number;
}
