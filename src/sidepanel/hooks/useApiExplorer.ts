/**
 * @module sidepanel/hooks/useApiExplorer
 * @description State/orchestration for the read-only API Explorer tab.
 *
 * Owns the path input, fires a GET through `useOktaApi().makeApiRequest` (the
 * scheduler-routed, guard-enforced transport every other feature already uses —
 * no new message action, no new content-script code), and derives the
 * redacted/shape views the response viewer needs from the one raw result.
 */
import { useCallback, useMemo, useState } from 'react';
import { useOktaApi } from './useOktaApi';
import { redactJson } from '../../shared/utils/redact';
import { shapeOutline } from '../../shared/utils/shapeInference';

/** One fetched response, derived into the three views `JsonViewer` switches between. */
export interface ApiExplorerResult {
  raw: unknown;
  redacted: unknown;
  redactedCount: number;
  shape: string;
  status?: number;
}

/** Options for {@link useApiExplorer}. */
export interface UseApiExplorerOptions {
  /** Content-script tab connected to Okta, or `null` when disconnected. */
  targetTabId: number | null;
  /** Live org origin, used to redact it out of embedded response URLs. */
  oktaOrigin?: string;
}

/** Return shape of {@link useApiExplorer}. */
export interface UseApiExplorerResult {
  path: string;
  setPath: (path: string) => void;
  /** Fire the GET request for the current `path`. No-ops when disconnected or empty. */
  send: () => void;
  isLoading: boolean;
  error: string | null;
  /** Dismiss the current error banner without sending a new request. */
  clearError: () => void;
  /** The most recent response's three derived views, or `null` before the first send. */
  result: ApiExplorerResult | null;
}

/**
 * Drives the API Explorer's request/response cycle. GET-only: the path is sent
 * exactly as typed, through the same same-origin-path + method-allow-list guards
 * every other Okta call already goes through.
 *
 * @example
 * ```tsx
 * const explorer = useApiExplorer({ targetTabId, oktaOrigin });
 * <Input value={explorer.path} onChange={explorer.setPath} />
 * <Button onClick={explorer.send} loading={explorer.isLoading}>Send</Button>
 * ```
 */
export function useApiExplorer({
  targetTabId,
  oktaOrigin,
}: UseApiExplorerOptions): UseApiExplorerResult {
  const [path, setPath] = useState('/api/v1/');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<{ data: unknown; status?: number } | null>(null);

  const api = useOktaApi({ targetTabId });

  const send = useCallback(() => {
    const trimmed = path.trim();
    if (!targetTabId || !trimmed) return;

    setError(null);
    setIsLoading(true);
    void (async () => {
      try {
        const outcome = await api.makeApiRequest(trimmed, 'GET', undefined, 'interactive');
        if (outcome.success) {
          setResponse({ data: outcome.data, status: outcome.status });
        } else {
          setResponse(null);
          setError(outcome.error || 'Request failed');
        }
      } catch (err) {
        setResponse(null);
        setError(err instanceof Error ? err.message : 'Request failed');
      } finally {
        setIsLoading(false);
      }
    })();
  }, [api, targetTabId, path]);

  const result = useMemo<ApiExplorerResult | null>(() => {
    if (!response) return null;
    const { data: redacted, redactedCount } = redactJson(response.data, oktaOrigin);
    return {
      raw: response.data,
      redacted,
      redactedCount,
      shape: shapeOutline(response.data),
      status: response.status,
    };
  }, [response, oktaOrigin]);

  const clearError = useCallback(() => setError(null), []);

  return { path, setPath, send, isLoading, error, clearError, result };
}
