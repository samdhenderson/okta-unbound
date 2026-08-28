/**
 * @module sidepanel/components/RequestLogRow
 * @description One entry in the History tab's verbose mode: a batch of Okta API
 * requests that shared a reason.
 *
 * A batch of one request renders its single endpoint inline; a larger batch
 * collapses to a count ("42 requests") with a disclosure — same `ListRow` +
 * `IconButton`/`aria-expanded` shape as {@link AuditLogRow}, so the two entry
 * kinds read as one list rather than two different UIs bolted together.
 *
 * Security: endpoints here were already redacted (`shared/utils/redact`)
 * before they reached storage, but this component still renders everything
 * through React's escaping and logs nothing.
 *
 * The disclosure toggle carries `.press` (ADR-0046) directly, mirroring
 * {@link AuditLogRow}. Disclosure-body padding and the badge run consume the
 * `--sp-row-x`/`--sp-row-y`/`--sp-inline` roles (ADR-0048), matching this
 * row's `compact` density.
 */
import React, { useId } from 'react';
import { Badge, IconButton, ListRow } from './shared';
import Icon from './shared/Icon';
import { formatActionTime } from '../../shared/undoManager';
import type { RequestLogEntry } from '../../shared/requestLogTypes';

/** The outcome mark a non-`'all'` batch wears. */
const OUTCOME_BADGE: Partial<
  Record<RequestLogEntry['outcome'], { label: string; variant: 'warning' | 'danger' }>
> = {
  partial: { label: 'Some failed', variant: 'warning' },
  none: { label: 'Failed', variant: 'danger' },
};

/** Props for {@link RequestLogRow}. */
export interface RequestLogRowProps {
  /** The request-log entry this row is about. */
  entry: RequestLogEntry;
  /** Whether the disclosure is open. Owned by the list, so a refresh cannot close a row. */
  isExpanded: boolean;
  /** Toggles this row's disclosure, by entry id. */
  onToggle: (entryId: string) => void;
}

/**
 * One row of the verbose request log: reason, request count, outcome, and a
 * disclosure holding the individual endpoints.
 *
 * @param props - See {@link RequestLogRowProps}.
 */
const RequestLogRow: React.FC<RequestLogRowProps> = ({ entry, isExpanded, onToggle }) => {
  // `useId`, not the entry id: a DOM id built from stored data is a selector
  // waiting to break, and React already hands out a unique one.
  const disclosureId = useId();
  const outcomeBadge = OUTCOME_BADGE[entry.outcome];
  const isBatch = entry.requestCount > 1;

  return (
    <ListRow
      density="compact"
      dataAttributes={{ 'data-request-log-id': entry.id }}
      body={
        // `.disclose` animates `grid-template-rows` 0fr → 1fr with no JS
        // measurement, and `inert` keeps the closed body out of the tab order and
        // the accessibility tree.
        <div
          id={disclosureId}
          className="disclose"
          data-open={isExpanded}
          inert={!isExpanded || undefined}
        >
          <div>
            <ul className="space-y-1 border-t border-neutral-200 px-(--sp-row-x) pb-(--sp-row-y) pt-2">
              {entry.endpoints.map((endpoint, index) => (
                <li key={`${endpoint.method} ${endpoint.endpoint} ${index}`} className="text-sm">
                  <span className="font-mono text-xs text-neutral-600">{endpoint.method}</span>{' '}
                  <span className="break-all text-neutral-900">{endpoint.endpoint}</span>
                </li>
              ))}
              {entry.endpointsTruncated && (
                <li className="text-xs text-neutral-500">
                  Showing {entry.endpoints.length} of {entry.requestCount} requests.
                </li>
              )}
            </ul>
          </div>
        </div>
      }
    >
      <div className="flex items-center gap-(--sp-inline)">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-neutral-900">
            {isBatch ? `${entry.requestCount} requests — ${entry.reason}` : entry.reason}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-(--sp-inline)">
            {!isBatch && (
              <Badge>
                {entry.endpoints[0]?.method} {entry.endpoints[0]?.endpoint}
              </Badge>
            )}
            {outcomeBadge && <Badge variant={outcomeBadge.variant}>{outcomeBadge.label}</Badge>}
            <span className="text-xs text-neutral-500">{formatActionTime(entry.timestamp)}</span>
          </div>
        </div>

        {isBatch && (
          <IconButton
            label={`${isExpanded ? 'Hide' : 'Show'} the ${entry.requestCount} requests for ${entry.reason}`}
            variant="ghost"
            size="sm"
            expanded={isExpanded}
            controls={disclosureId}
            className="shrink-0"
            onClick={() => onToggle(entry.id)}
          >
            <Icon
              type="chevron-right"
              size="sm"
              className={`transition-transform duration-(--dur-quick) ${isExpanded ? 'rotate-90' : ''}`}
            />
          </IconButton>
        )}
      </div>
    </ListRow>
  );
};

export default RequestLogRow;
