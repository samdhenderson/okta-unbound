/**
 * @module sidepanel/components/export/ExportTab
 * @description The Export tab: a descriptor-driven hub for downloading Okta reports.
 *
 * Builds the {@link ExportApiDeps} from `useOktaApi`, assembles the descriptor
 * registry, and drives the whole flow through {@link useExportTab}. A `pick` phase
 * lists exportable entities ({@link EntityPicker}); a `configure` phase composes the
 * context picker, filter box, column picker, preset controls, action buttons, and
 * preview table. Every Okta read routes through the rate-limited scheduler path; no
 * entity-specific code lives here, so new descriptors need zero tab changes.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PageHeader, AlertMessage, Button } from '../shared';
import { useOktaApi } from '../../hooks/useOktaApi';
import { useExportTab } from '../../hooks/useExportTab';
import { buildRegistry } from '../../export/registry';
import type { ExportApiDeps } from '../../export/types.deps';
import EntityPicker from './EntityPicker';
import ExportContextBar from './ExportContextBar';
import ExportFilterBox from './ExportFilterBox';
import ColumnPicker from './ColumnPicker';
import PresetControls from './PresetControls';
import ExportPreviewTable from './ExportPreviewTable';

/**
 * A one-shot request to open the Export tab pre-scoped to a specific descriptor
 * and context entity (e.g. from the group Overview's "Export Members").
 */
export interface ExportRequest {
  /** Descriptor id to select (e.g. `'group-memberships'`). */
  descriptorId: string;
  /** The context entity's Okta id (e.g. the group id). */
  contextId: string;
  /** The context entity's display label (folded into the export filename). */
  contextLabel: string;
}

/** Props for {@link ExportTab}. */
interface ExportTabProps {
  /** Chrome tab id of the connected Okta tab; export/preview are disabled when absent. */
  targetTabId?: number;
  /** Okta org origin used to build per-row deep links in the preview. */
  oktaOrigin?: string;
  /** One-shot request to open pre-scoped to a descriptor + context; cleared once consumed. */
  exportRequest?: ExportRequest | null;
  /** Invoked once {@link ExportTabProps.exportRequest} has been applied. */
  onExportRequestConsumed?: () => void;
}

/**
 * Renders the Export tab and orchestrates the descriptor-driven export flow.
 */
const ExportTab: React.FC<ExportTabProps> = ({
  targetTabId,
  oktaOrigin,
  exportRequest,
  onExportRequestConsumed,
}) => {
  const [error, setError] = useState<string | null>(null);

  // Must be stable: useOktaApi memoizes its operations on this callback's identity.
  const handleResult = useCallback(
    (message: string, type: 'info' | 'success' | 'warning' | 'error') => {
      if (type === 'error') setError(message);
    },
    [],
  );

  const api = useOktaApi({ targetTabId: targetTabId ?? null, onResult: handleResult });

  const deps: ExportApiDeps = useMemo(
    () => ({
      searchGroups: async (query: string) => {
        const groups = await api.searchGroups(query);
        return groups.map((group) => ({
          id: group.id,
          label: group.name,
          sublabel: group.type,
        }));
      },
      searchApps: async (query: string) => {
        const apps = await api.searchApps(query);
        return apps.map((app) => ({
          id: app.id,
          label: app.label,
          sublabel: app.status,
        }));
      },
    }),
    [api],
  );

  const registry = useMemo(() => buildRegistry(deps), [deps]);

  const tab = useExportTab({
    api,
    registry,
    deps,
    oktaOrigin,
    hasConnectedTab: targetTabId != null,
    onError: setError,
  });

  const { descriptor, selectEntity, setContext } = tab;

  // Fulfil a one-shot deep-link (e.g. Overview's "Export Members"): select the
  // requested descriptor and seed its context so the tab opens pre-scoped.
  const handledExportRef = useRef<string | null>(null);
  useEffect(() => {
    if (!exportRequest) {
      handledExportRef.current = null;
      return;
    }
    const key = `${exportRequest.descriptorId}:${exportRequest.contextId}`;
    if (handledExportRef.current === key) return;
    handledExportRef.current = key;
    selectEntity(exportRequest.descriptorId);
    setContext({ id: exportRequest.contextId, label: exportRequest.contextLabel });
    onExportRequestConsumed?.();
  }, [exportRequest, selectEntity, setContext, onExportRequestConsumed]);

  return (
    <div className="tab-content active" style={{ fontFamily: 'var(--font-primary)', padding: 0 }}>
      <PageHeader title="Export" subtitle="Download reports across your org" />

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {!tab.hasConnectedTab && (
          <AlertMessage message={{ type: 'danger', text: 'Connect an Okta tab to export.' }} />
        )}

        {error && (
          <AlertMessage
            message={{ type: 'danger', text: error }}
            onDismiss={() => setError(null)}
          />
        )}

        {tab.phase === 'pick' || !descriptor ? (
          <EntityPicker descriptors={tab.descriptors} onSelect={tab.selectEntity} />
        ) : (
          <div className="space-y-6">
            <Button variant="secondary" size="sm" icon="minus" onClick={tab.backToPick}>
              All exports
            </Button>

            <div>
              <h2 className="text-lg font-semibold text-neutral-900">{descriptor.displayName}</h2>
              <p className="mt-0.5 text-sm text-neutral-600">{descriptor.description}</p>
            </div>

            {descriptor.context.kind === 'search-to-select' && (
              <ExportContextBar
                key={descriptor.id}
                label={descriptor.context.label}
                placeholder={descriptor.context.placeholder}
                search={tab.contextSearch}
                onSelect={tab.setContext}
                initialSelected={
                  tab.contextId
                    ? { id: tab.contextId, label: tab.contextLabel ?? tab.contextId }
                    : null
                }
              />
            )}

            {descriptor.filter.kind !== 'none' && (
              <ExportFilterBox
                value={tab.filterText}
                onChange={tab.setFilterText}
                help={descriptor.filter.help}
                placeholder={descriptor.filter.placeholder}
                matchCount={tab.matchCount}
                matchCountLoading={tab.matchCountLoading}
                disabled={descriptor.context.kind === 'search-to-select' && tab.contextId === null}
              />
            )}

            <ColumnPicker
              catalog={descriptor.columnCatalog}
              enabled={tab.enabledColumnIds}
              onToggle={tab.toggleColumn}
            />

            <PresetControls
              presets={tab.presets}
              activePresetId={tab.activePresetId}
              onApply={tab.applyPreset}
              onSave={tab.savePreset}
              onDelete={tab.deletePreset}
              canSave={tab.enabledCount > 0}
            />

            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                onClick={tab.loadPreview}
                disabled={!tab.canExport}
                loading={tab.isBusy}
              >
                Preview
              </Button>
              <Button
                variant="primary"
                icon="download"
                onClick={tab.download}
                disabled={!tab.canExport}
                loading={tab.isBusy}
              >
                Download CSV
              </Button>
            </div>

            {tab.previewRows !== null && (
              <ExportPreviewTable
                columns={tab.enabledColumns}
                rows={tab.previewRows}
                fetched={tab.fetched}
                dropped={tab.dropped}
                capped={tab.capped}
                linkify={descriptor.linkify}
                oktaOrigin={oktaOrigin}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ExportTab;
