/**
 * @module sidepanel/components/ApiExplorerTab
 * @description API Explorer tab: fire a read-only GET request and inspect the response.
 *
 * A dev-tool surface for discovering what an Okta endpoint's response actually
 * contains — useful when `expand=...` or `_embedded` returns fields the public
 * docs omit. GET-only by design: it reuses `makeApiRequest` exactly as every
 * other feature does (same same-origin-path guard, same method allow-list, same
 * scheduler), with no new message action and no write surface. Write support is a
 * deliberately separate, future ADR-gated feature.
 *
 * The response viewer defaults to the values-free Shape view; Redacted and Raw
 * are one click away (see `JsonViewer`/`redact.ts`/`shapeInference.ts`).
 *
 * The root's gap consumes `--sp-rung` (ADR-0048) rather than the raw `space-y-4`
 * it shipped with — at the `default` density that role resolves to the same 16px
 * this file already used, so the value is unchanged today and only starts moving
 * with panel width, matching the other five tab roots' `--sp-rung` stack instead
 * of standing apart from them by half a step.
 */
import React from 'react';
import { AlertMessage, Badge, Button, EmptyState, Input, JsonViewer, PageHeader } from './shared';
import { useApiExplorer } from '../hooks/useApiExplorer';

/** Props for {@link ApiExplorerTab}. */
export interface ApiExplorerTabProps {
  /** Chrome tab id of the connected Okta tab; sending is disabled when null. */
  targetTabId: number | null;
  /** Okta org origin, used to redact it out of embedded response URLs. */
  oktaOrigin?: string;
}

const statusVariant = (
  status: number | undefined,
): 'success' | 'warning' | 'danger' | 'neutral' => {
  if (status === undefined) return 'neutral';
  if (status >= 200 && status < 300) return 'success';
  if (status >= 400 && status < 500) return 'warning';
  if (status >= 500) return 'danger';
  return 'neutral';
};

/**
 * Renders the API Explorer: a locked-to-GET request bar and a response viewer
 * that switches between a values-free Shape outline, a redacted value tree, and
 * the raw response.
 */
const ApiExplorerTab: React.FC<ApiExplorerTabProps> = ({ targetTabId, oktaOrigin }) => {
  const { path, setPath, send, isLoading, error, clearError, result } = useApiExplorer({
    targetTabId,
    oktaOrigin,
  });

  const canSend = Boolean(targetTabId) && path.trim().length > 0 && !isLoading;

  return (
    <div className="tab-content active" style={{ fontFamily: 'var(--font-primary)', padding: 0 }}>
      <PageHeader
        title="API Explorer"
        subtitle="Fire a read-only GET request and inspect the response"
      />

      <div className="max-w-7xl mx-auto px-(--sp-gutter) py-(--sp-gutter) space-y-(--sp-rung)">
        <div className="flex items-center gap-2">
          <Badge variant="neutral" solid title="Read-only for now — writes are a future feature">
            GET
          </Badge>
          <Input
            value={path}
            onChange={setPath}
            placeholder="/api/v1/apps?expand=user/{userId}"
            ariaLabel="API path"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canSend) send();
            }}
          />
          <Button variant="primary" onClick={send} disabled={!canSend} loading={isLoading}>
            Send
          </Button>
        </div>

        {error && <AlertMessage message={{ text: error, type: 'danger' }} onDismiss={clearError} />}

        {result && (
          <div className="flex items-center gap-2">
            <Badge variant={statusVariant(result.status)}>{result.status ?? 'unknown'}</Badge>
          </div>
        )}

        {result ? (
          <JsonViewer
            raw={result.raw}
            redacted={result.redacted}
            redactedCount={result.redactedCount}
            shape={result.shape}
          />
        ) : (
          !error && (
            <EmptyState
              icon="search"
              title="No request sent yet"
              description="Type a same-origin Okta API path (e.g. /api/v1/apps?expand=user/{userId}) and press Send."
            />
          )
        )}
      </div>
    </div>
  );
};

export default ApiExplorerTab;
