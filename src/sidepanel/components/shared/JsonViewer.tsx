/**
 * @module sidepanel/components/shared/JsonViewer
 * @description Response viewer with a Shape/Redacted/Raw switcher, built for the API Explorer.
 *
 * A pure presentational component: it owns only which view is active, never how
 * the redacted or shape data was produced — the caller (`useApiExplorer`) computes
 * `redacted`/`shape` up front via `redact.ts`/`shapeInference.ts` and hands them in
 * alongside the untouched `raw` value.
 *
 * Opens on **Shape** (the values-free view) rather than Redacted or Raw, since it
 * is the one view immune to any gap in the pattern-based redaction — the safer
 * default for a tool whose purpose is preparing data to leave the extension. Raw
 * carries an explicit warning strip so it never gets mistaken for the redacted view.
 */
import React, { useState } from 'react';
import Tabs from './Tabs';
import CopyButton from './CopyButton';
import AlertMessage from './AlertMessage';
import JsonNode from './JsonNode';

type ViewMode = 'shape' | 'redacted' | 'raw';

interface JsonViewerProps {
  /** Untouched response data, exactly as returned by the API call. */
  raw: unknown;
  /** `raw` with PII/Okta-id substrings swapped for placeholders (see `redact.ts`). */
  redacted: unknown;
  /** How many substitutions `redact.ts` made producing `redacted`. */
  redactedCount: number;
  /** Pre-rendered, values-free type outline of `raw` (see `shapeInference.ts`). */
  shape: string;
  className?: string;
}

/**
 * Switches between a type-only shape outline, a redacted value tree, and the raw
 * response — with a copy button that always copies whichever view is active.
 *
 * @example
 * ```tsx
 * const { data: redacted, redactedCount } = redactJson(response.data, oktaOrigin);
 * <JsonViewer
 *   raw={response.data}
 *   redacted={redacted}
 *   redactedCount={redactedCount}
 *   shape={shapeOutline(response.data)}
 * />
 * ```
 */
const JsonViewer: React.FC<JsonViewerProps> = ({
  raw,
  redacted,
  redactedCount,
  shape,
  className = '',
}) => {
  const [view, setView] = useState<ViewMode>('shape');

  const getCopyText = () => {
    if (view === 'shape') return shape;
    return JSON.stringify(view === 'redacted' ? redacted : raw, null, 2);
  };

  return (
    <div className={className}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <Tabs
          variant="segmented"
          ariaLabel="Response view"
          activeKey={view}
          onChange={(key) => setView(key as ViewMode)}
          tabs={[
            { key: 'shape', label: 'Shape' },
            {
              key: 'redacted',
              label: 'Redacted',
              count: redactedCount > 0 ? redactedCount : undefined,
            },
            { key: 'raw', label: 'Raw' },
          ]}
        />
        <CopyButton label="Copy" getText={getCopyText} size="sm" />
      </div>

      {view === 'raw' && (
        <AlertMessage
          className="mb-2"
          message={{
            type: 'warning',
            text: 'Raw is fully unredacted — confirm before pasting this anywhere else.',
          }}
        />
      )}

      <div className="max-h-[60vh] overflow-auto rounded-md border border-neutral-200 bg-white p-3">
        {view === 'shape' ? (
          <pre className="whitespace-pre-wrap font-mono text-xs">{shape}</pre>
        ) : (
          <JsonNode value={view === 'redacted' ? redacted : raw} depth={0} />
        )}
      </div>
    </div>
  );
};

export default JsonViewer;
